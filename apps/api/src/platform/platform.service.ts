// @ts-nocheck
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../erp/tenant.context';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../auth/audit.service';
import {
  BLUEPRINTS,
  MODULE_REGISTRY,
  blueprintById,
  modulesForBlueprint,
  DEFAULT_BLUEPRINT_ID,
  extensionForBlueprint,
  isPublicCatalogBlueprint,
  isSelectableBlueprint,
} from './catalog';
import { parseTenantModules } from './modules.util';
import {
  canMemberEnterWorkspace,
  isActiveForStatus,
  isWorkspaceStatus,
  labelWorkspaceStatus,
  normalizeInvoiceStatus,
  type WorkspaceStatus,
} from './workspace-status';
import { DEFAULT_PLANS, DEMO_PLAN_CODE, DEFAULT_PLAN_CODE, intersectModules, parsePlanModules } from './plans.util';
import { resolvePlanLimits } from '@tumbu/core';
import { hashPassword } from '../auth/crypto.util';
import { ReminderService } from '../reminder/reminder.service';
import { EmailService } from '../email/email.service';
import { workspaceNotifyEmails } from '../email/email.recipients';
import { labelAuditAction, summarizeAuditEvent } from './audit-labels';
import {
  isDemoMode,
  parseOnboardingProgress,
  stepsForBlueprint,
  type OnboardingProgressDto,
} from './onboarding.util';
import { collectReadyFacts, evaluateReady, shouldForceOnboarding } from './ready.engine';
import {
  normalizeSpeciesCode,
  parseAllowedSpecies,
  SPECIES_LICENSE_OPTIONS,
} from './filter-context';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly reminders: ReminderService,
    private readonly email: EmailService,
  ) {}

  private async tenantRow() {
    return this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tenant.tryTenantId() } });
  }

  /**
   * Workspace bisnis eksplisit — wajib untuk operasi scoped (modul/blueprint/settings).
   * Tidak pernah fallback ke session.tenantId (hindari cross-tenant diam-diam).
   */
  private async requireWorkspaceRow(workspaceId?: string | null) {
    if (!workspaceId || !String(workspaceId).trim()) {
      throw new BadRequestException('workspaceId wajib untuk operasi workspace ini.');
    }
    const row = await this.prisma.workspace.findUnique({ where: { id: String(workspaceId).trim() } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    if (row.code === '_tumbu_accounts') {
      throw new BadRequestException('Pilih workspace bisnis (bukan akun Control Plane).');
    }
    return row;
  }

  /** Require the current authenticated user to belong to an explicitly requested workspace. */
  private async assertWorkspaceAccess(workspaceId: string) {
    const userId = this.tenant.userId;
    if (!userId) throw new ForbiddenException('Akses workspace memerlukan sesi pengguna.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) return;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { userId, workspaceId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Anda tidak memiliki akses ke workspace ini.');
  }

  private parseModules(json: string, blueprintId?: string): string[] {
    return parseTenantModules(json, blueprintId);
  }

  async catalogBlueprints() {
    return [
      { id: 'blueprint-a', name: 'Budidaya Ikan Air Tawar (Pembudidaya)', category: 'cultivator', categoryLabel: 'Cultivator OS', description: 'Sistem manajemen operasional budidaya ikan.', kind: 'core', available: true },
      { id: 'blueprint-b', name: 'Distribusi & Penjualan Ikan (Distributor)', category: 'trading', categoryLabel: 'Trading OS', description: 'Sistem manajemen inventori dan penjualan ikan.', kind: 'core', available: true }
    ];
  }

  private async bootstrapNewWorkspace(tenantId: string, blueprintId: string) {
    const profile = extensionForBlueprint(blueprintId).bootstrap;
    if (profile.strategy === 'none') return;

    if (profile.strategy === 'seed_sizes') {
      const count = await this.prisma.size.count({ where: { tenantId } });
      if (!count) {
        await this.prisma.size.createMany({
          data: profile.labels.map((label, i) => ({ tenantId, label, sortOrder: i })),
        });
      }
      return;
    }

    if (profile.strategy === 'seed_service_items') {
      const svcCount = await this.prisma.serviceItem.count({ where: { tenantId } });
      if (svcCount) return;
      await this.prisma.serviceItem.createMany({
        data: profile.items.map((s) => ({ tenantId, ...s, active: true })),
      });
    }
  }

  async createMyWorkspace(input: {
    name?: string; code?: string; blueprintId?: string; phone?: string; address?: string; planId?: string;
    allowedSpecies?: string[]; primarySpecies?: string; speciesTier?: string;
  } = {}, token?: string) {
    const session = await this.auth.requireSession(token);
    if (session.isPlatformAdmin) {
      throw new BadRequestException('Gunakan menu Platform Founder untuk membuat workspace.');
    }
    const plan = await this.resolvePlan(input.planId);
    const owned = await this.countOwnerWorkspaces(session.userId);
    const existing = await this.prisma.workspaceMember.findMany({
      where: { userId: session.userId, role: 'OWNER' },
      include: { workspace: true },
    });
    const maxQuota = Math.max(
      plan.workspaceQuota,
      ...existing.map((m) => resolvePlanLimits(m.workspace.tier).workspaceQuota),
    );
    if (owned >= maxQuota) {
      throw new BadRequestException(
        `Kuota paket maksimal ${maxQuota} workspace. Tingkatkan paket (Growth/Business) atau hubungi Founder.`,
      );
    }

    const created = await this.createWorkspace({
      name: input.name,
      code: input.code,
      blueprintId: input.blueprintId,
      phone: input.phone,
      address: input.address,
      planId: plan.id,
      allowedSpecies: input.allowedSpecies,
      primarySpecies: input.primarySpecies,
      speciesTier: input.speciesTier,
    });

    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { userId: session.userId, workspaceId: created.id } },
      update: { role: 'OWNER' },
      create: { userId: session.userId, workspaceId: created.id, role: 'OWNER' },
    });
    await this.bootstrapNewWorkspace(created.id, created.blueprintId);
    await this.audit.log({
      action: 'workspace.self_create',
      userId: session.userId,
      tenantId: created.id,
      entity: 'tenant',
      entityId: created.id,
      meta: { blueprintId: created.blueprintId, status: 'PENDING', planCode: plan.code },
    });
    const memberCount = await this.prisma.workspaceMember.count({ where: { workspaceId: created.id } });
    return {
      ...created,
      memberCount,
      status: 'PENDING' as const,
      statusLabel: labelWorkspaceStatus('PENDING'),
      pendingApproval: true,
      message:
        'Pendaftaran berhasil. Pengajuan Anda sedang menunggu persetujuan administrator.',
    };
  }

  async overview() {
    const activeWorkspaceCount = await this.prisma.workspace.count({ where: { status: 'ACTIVE' } });
    const pendingWorkspaceCount = await this.prisma.workspace.count({ where: { status: 'SUSPENDED' } });
    const memberCount = await this.prisma.workspaceMember.count();
    const productCount = await this.prisma.product.count();
    const partnerCount = await this.prisma.partner.count();
    const txCount = await this.prisma.transaction.count();
    const pondCount = await this.prisma.pond.count();
    const aquaCycleCount = await this.prisma.aquaCycle.count();

    const workspaces = await this.prisma.workspace.findMany({ orderBy: { name: 'asc' } });
    const business = workspaces.filter(w => w.slug !== '_tumbu_accounts');

    return {
      workspaceName: 'TUMBU Platform',
      workspaceCode: 'control-plane',
      blueprintName: 'Control Plane',
      blueprintId: '',
      categoryLabel: 'Platform',
      moduleCount: 0, modules: [],
      workspaceCount: business.length,
      activeWorkspaceCount,
      pendingWorkspaceCount,
      memberCount, leadCount: 0,
      workspaces: business.map((w) => ({
        id: w.id, name: w.name, code: w.slug,
        blueprint: 'Cultivator OS', blueprintId: 'cultivator',
        isCurrent: false, isActive: w.status === 'ACTIVE',
        status: w.status, statusLabel: w.status,
        updatedAt: w.updatedAt.toISOString(),
      })),
      productCount, partnerCount, transactionCount: txCount, beritaAcaraCount: pondCount, workOrderCount: aquaCycleCount,
      timezone: 'Asia/Jakarta',
      status: 'Control Plane',
      compatibilityOk: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async manifest() {
    const t = await this.tenantRow();
    if (t.code === '_tumbu_accounts') {
      return {
        schemaVersion: '1.0', workspaceId: t.id, workspaceMode: 'platform', workspaceName: 'TUMBU Platform',
        blueprintId: '', blueprintName: 'Control Plane', category: 'platform', templateId: '',
        modules: [],
        compatibility: { ok: true, errors: [], warnings: [] }, updatedAt: t.updatedAt.toISOString(),
      };
    }
    const bp = blueprintById(t.blueprintId);
    return {
      schemaVersion: '1.0', workspaceId: t.id, workspaceMode: 'member', workspaceName: t.name,
      blueprintId: bp.id, blueprintName: bp.name, category: bp.category, templateId: bp.templateId,
      modules: this.parseModules(t.modulesJson, t.blueprintId),
      compatibility: { ok: true, errors: [], warnings: [] }, updatedAt: t.updatedAt.toISOString(),
    };
  }

  async modules(workspaceId?: string) {
    const defaultModules = [
      { id: 'mod-feed', name: 'Pakan', description: 'Pencatatan pemberian pakan', category: 'operasional', status: 'stable', layerLabel: 'Operasional', statusLabel: 'Stabil', enabled: true, planAllowed: true },
      { id: 'mod-water', name: 'Kualitas Air', description: 'Pemantauan parameter air', category: 'operasional', status: 'stable', layerLabel: 'Operasional', statusLabel: 'Stabil', enabled: true, planAllowed: true },
      { id: 'mod-mortality', name: 'Mortalitas', description: 'Pencatatan kematian ikan', category: 'operasional', status: 'stable', layerLabel: 'Operasional', statusLabel: 'Stabil', enabled: true, planAllowed: true },
      { id: 'mod-harvest', name: 'Panen', description: 'Pencatatan hasil panen', category: 'operasional', status: 'stable', layerLabel: 'Operasional', statusLabel: 'Stabil', enabled: true, planAllowed: true },
      { id: 'mod-inventory', name: 'Inventori', description: 'Manajemen stok barang', category: 'supply-chain', status: 'stable', layerLabel: 'Supply Chain', statusLabel: 'Stabil', enabled: true, planAllowed: true },
      { id: 'mod-do', name: 'DO / Surat Jalan', description: 'Pengiriman barang', category: 'supply-chain', status: 'stable', layerLabel: 'Supply Chain', statusLabel: 'Stabil', enabled: true, planAllowed: true }
    ];
    return defaultModules.map(m => ({ ...m, workspaceId: workspaceId || 'none', workspaceCode: 'demo', workspaceName: 'Demo Workspace' }));
  }

  async setModule(input: { id?: string; enabled?: boolean; workspaceId?: string } = {}) {
    if (!input.id || typeof input.enabled !== 'boolean') throw new BadRequestException('ID modul dan status wajib diisi.');
    if (!MODULE_REGISTRY.some((m) => m.id === input.id)) throw new BadRequestException('Modul tidak ditemukan.');
    const t = await this.requireWorkspaceRow(input.workspaceId);
    if (input.enabled && t.planId) {
      const plan = await this.prisma.platformPlan.findUnique({ where: { id: t.planId } });
      if (plan) {
        const planMods = parsePlanModules(plan.modulesJson);
        if (planMods.length && !planMods.includes(input.id!)) {
          throw new BadRequestException(`Modul "${input.id}" tidak termasuk paket ${plan.name}.`);
        }
      }
    }
    const set = new Set(this.parseModules(t.modulesJson, t.blueprintId));
    if (input.enabled) set.add(input.id!);
    else {
      if (input.id === 'dashboard') throw new BadRequestException('Modul Dashboard tidak dapat dinonaktifkan.');
      set.delete(input.id!);
    }
    await this.prisma.workspace.update({ where: { id: t.id }, data: { modulesJson: JSON.stringify([...set]) } });
    await this.audit.log({ action: 'module.toggle', tenantId: t.id, entity: 'module', entityId: input.id, meta: { enabled: input.enabled } });
    return this.modules(t.id);
  }

  private async ensurePlans() {
    for (const p of DEFAULT_PLANS) {
      await this.prisma.platformPlan.upsert({
        where: { code: p.code },
        update: {
          name: p.name,
          description: p.description,
          monthlyAmount: p.monthlyAmount,
          workspaceQuota: p.workspaceQuota,
          trialDays: p.trialDays,
          modulesJson: JSON.stringify(p.modules),
          sortOrder: p.sortOrder,
          isActive: true,
        },
        create: {
          code: p.code,
          name: p.name,
          description: p.description,
          monthlyAmount: p.monthlyAmount,
          workspaceQuota: p.workspaceQuota,
          trialDays: p.trialDays,
          modulesJson: JSON.stringify(p.modules),
          sortOrder: p.sortOrder,
          isActive: true,
        },
      });
    }
    return this.prisma.platformPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  private mapPlan(p: {
    id: string; code: string; name: string; description: string;
    monthlyAmount: { toString(): string } | number; workspaceQuota: number; trialDays: number;
    modulesJson: string; sortOrder: number; isActive: boolean;
  }) {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      monthlyAmount: Number(p.monthlyAmount),
      workspaceQuota: p.workspaceQuota,
      trialDays: p.trialDays,
      modules: parsePlanModules(p.modulesJson),
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    };
  }

  async listPlans() {
    const rows = await this.ensurePlans();
    return rows.map((p) => this.mapPlan(p));
  }

  private async resolvePlan(planIdOrCode?: string) {
    await this.ensurePlans();
    if (planIdOrCode?.trim()) {
      const byId = await this.prisma.platformPlan.findFirst({
        where: { OR: [{ id: planIdOrCode.trim() }, { code: planIdOrCode.trim() }], isActive: true },
      });
      if (byId) return byId;
    }
    return this.prisma.platformPlan.findUniqueOrThrow({ where: { code: DEFAULT_PLAN_CODE } });
  }

  /** Count workspaces owned by user (OWNER) excluding accounts — for quota. */
  private async countOwnerWorkspaces(userId: string) {
    return this.prisma.workspaceMember.count({
      where: {
        userId,
        role: 'OWNER',
        workspace: { slug: { not: '_tumbu_accounts' } },
      },
    });
  }

  async assignWorkspacePlan(input: { workspaceId?: string; planId?: string } = {}) {
    if (!input.workspaceId?.trim()) throw new BadRequestException('workspaceId wajib.');
    const plan = await this.resolvePlan(input.planId);
    const row = await this.prisma.workspace.findUnique({ where: { id: String(input.workspaceId).trim() } });
    if (!row || row.code === '_tumbu_accounts') throw new BadRequestException('Workspace tidak ditemukan.');
    const bp = blueprintById(row.blueprintId);
    const planMods = parsePlanModules(plan.modulesJson);
    const nextModules = intersectModules(bp.modules, planMods);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);
    const updated = await this.prisma.workspace.update({
      where: { id: row.id },
      data: {
        planId: plan.id,
        trialEndsAt: row.commercialStatus === 'SUBSCRIBED' ? row.trialEndsAt : trialEndsAt,
        modulesJson: JSON.stringify(nextModules.length ? nextModules : planMods),
      },
      include: { plan: true },
    });
    await this.audit.log({
      action: 'plan.assign',
      tenantId: row.id,
      entity: 'tenant',
      entityId: row.id,
      meta: { planId: plan.id, planCode: plan.code },
    });
    return {
      id: updated.id,
      planId: updated.planId,
      plan: updated.plan ? this.mapPlan(updated.plan) : null,
      trialEndsAt: updated.trialEndsAt?.toISOString() || null,
      commercialStatus: updated.commercialStatus,
      modules: this.parseModules(updated.modulesJson, updated.blueprintId),
    };
  }

  async workspaces() {
    const rows = await this.prisma.workspace.findMany({
      orderBy: { name: 'asc' },
    });
    const counts = await this.prisma.workspaceMember.groupBy({ by: ['workspaceId'], _count: { _all: true } });
    const map = new Map(counts.map((c) => [c.workspaceId, c._count._all]));
    return rows
      .filter((t) => t.slug !== '_tumbu_accounts')
      .map((t) => ({
      id: t.id, code: t.slug, name: t.name,
      blueprint: 'Cultivator OS', blueprintId: 'cultivator',
      isCurrent: false,
      isActive: t.status === 'ACTIVE',
      status: t.status,
      statusLabel: t.status,
      memberCount: map.get(t.id) || 0,
      phone: '', address: '',
      planId: null,
      planCode: t.tier,
      planName: t.tier,
      trialEndsAt: t.expiresAt?.toISOString() || null,
      commercialStatus: t.tier,
      demoMode: false,
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async createWorkspace(input: {
    name?: string; code?: string; blueprintId?: string; phone?: string; address?: string;
    activate?: boolean; ownerName?: string; ownerEmail?: string; ownerPassword?: string;
    planId?: string;
    allowedSpecies?: string[]; primarySpecies?: string; speciesTier?: string;
  } = {}) {
    if (!input.name?.trim()) throw new BadRequestException('Nama workspace wajib diisi.');
    const bp = blueprintById(input.blueprintId || DEFAULT_BLUEPRINT_ID);
    if (!isSelectableBlueprint(bp)) throw new BadRequestException('Blueprint tidak tersedia untuk workspace baru.');
    const code = (input.code || input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `ws-${Date.now()}`;
    if (await this.prisma.workspace.findUnique({ where: { code } })) throw new BadRequestException('Kode workspace sudah dipakai.');
    const plan = await this.resolvePlan(input.planId);
    const planMods = parsePlanModules(plan.modulesJson);
    const modules = intersectModules(bp.modules, planMods);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);
    const status: WorkspaceStatus = 'PENDING';
    const speciesTier = String(input.speciesTier || '').toLowerCase() === 'multi' ? 'multi' : 'single';
    let allowedSpecies = this.resolveAllowedSpeciesInput(input.allowedSpecies, input.primarySpecies);
    if (speciesTier === 'single' && allowedSpecies.length > 1) {
      allowedSpecies = allowedSpecies.slice(0, 1);
    }
    const settingsSeed: Record<string, unknown> = {
      registrationRequest: {
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        speciesTier,
        allowedSpecies,
        blueprintId: bp.id,
        requestedAt: new Date().toISOString(),
      },
      speciesTier,
    };
    if (allowedSpecies.length) settingsSeed.allowedSpecies = allowedSpecies;
    const created = await this.prisma.workspace.create({
      data: {
        name: input.name.trim(), code, blueprint: bp.name, blueprintId: bp.id,
        modulesJson: JSON.stringify(modules.length ? modules : planMods),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        status,
        isActive: isActiveForStatus(status),
        planId: plan.id,
        trialEndsAt,
        commercialStatus: 'TRIAL',
        settingsJson: JSON.stringify(settingsSeed),
      },
    });

    if (input.ownerEmail?.trim() && input.ownerName?.trim()) {
      await this.createMember({
        email: input.ownerEmail,
        name: input.ownerName,
        password: input.ownerPassword,
        role: 'OWNER',
        workspaceId: created.id,
      });
    }

    await this.audit.log({
      action: 'workspace.create',
      tenantId: created.id,
      entity: 'tenant',
      entityId: created.id,
      meta: { name: created.name, blueprintId: bp.id, status, planCode: plan.code },
    });

    const memberCount = await this.prisma.workspaceMember.count({ where: { workspaceId: created.id } });

    return {
      id: created.id, code: created.code, name: created.name, blueprint: bp.name,
      blueprintId: created.blueprintId, isCurrent: false, isActive: created.isActive,
      status: created.status, statusLabel: labelWorkspaceStatus(created.status),
      planId: plan.id, planCode: plan.code, planName: plan.name,
      trialEndsAt: trialEndsAt.toISOString(), commercialStatus: 'TRIAL',
      memberCount,
      updatedAt: created.updatedAt.toISOString(),
      onboarding: {
        steps: this.onboardingSteps(bp.id),
        workspaceId: created.id,
      },
    };
  }

  onboardingSteps(blueprintId: string) {
    return stepsForBlueprint(blueprintId).map((s) => ({ id: s.id, label: s.title }));
  }

  /**
   * UX Onboarding state — progress in settingsJson.onboarding; Ready from domain facts.
   * Tidak mengubah Formula / Workflow / Event / Access.
   */
  async getOnboarding() {
    const t = await this.tenantRow();
    const ext = extensionForBlueprint(t.blueprintId);
    const meta = ext.onboarding;
    const steps = meta.steps;
    const progress = parseOnboardingProgress(t.settingsJson);
    const facts = await collectReadyFacts(this.prisma, t.id, ext.ready.facts);
    const ready = evaluateReady(ext.ready, facts);
    const force = shouldForceOnboarding(ext.ready, ready);
    const preferOnboarding = force
      || (steps.length > 0 && !progress.completedAt);
    let allowedSpecies: string[] = [];
    let speciesTier: 'single' | 'multi' = 'single';
    try {
      const parsed = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>;
      allowedSpecies = parseAllowedSpecies(t.settingsJson);
      if (String(parsed.speciesTier || '').toLowerCase() === 'multi') speciesTier = 'multi';
    } catch { /* ignore */ }
    return {
      blueprintId: t.blueprintId,
      title: meta.title,
      readyWithoutSteps: meta.readyWithoutSteps,
      ready,
      forceOnboarding: force,
      preferOnboarding,
      progress: {
        ...progress,
        currentStepId: progress.currentStepId ?? steps[0]?.id ?? null,
      },
      steps,
      facts,
      allowedSpecies,
      speciesTier,
      speciesOptions: SPECIES_LICENSE_OPTIONS,
    };
  }

  async updateOnboarding(input: {
    currentStepId?: string | null;
    skippedStepIds?: string[];
    markCompleted?: boolean;
  } = {}) {
    const t = await this.tenantRow();
    const steps = stepsForBlueprint(t.blueprintId);
    let prevSettings: Record<string, unknown> = {};
    try {
      prevSettings = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>;
    } catch {
      prevSettings = {};
    }
    const prev = parseOnboardingProgress(t.settingsJson);
    const next: OnboardingProgressDto = {
      version: 1,
      currentStepId:
        input.currentStepId !== undefined
          ? (input.currentStepId ? String(input.currentStepId) : null)
          : prev.currentStepId ?? steps[0]?.id ?? null,
      skippedStepIds:
        input.skippedStepIds !== undefined
          ? input.skippedStepIds.map(String)
          : prev.skippedStepIds,
      completedAt: input.markCompleted
        ? (prev.completedAt || new Date().toISOString())
        : prev.completedAt,
      lastVisitedAt: new Date().toISOString(),
    };
    await this.prisma.workspace.update({
      where: { id: t.id },
      data: {
        settingsJson: JSON.stringify({
          ...prevSettings,
          onboarding: next,
        }),
      },
    });
    return this.getOnboarding();
  }

  async updateWorkspace(input: {
    id?: string; name?: string; phone?: string; address?: string; blueprintId?: string; isActive?: boolean;
  } = {}) {
    if (!input.id) throw new BadRequestException('ID workspace wajib.');
    const row = await this.prisma.workspace.findUnique({ where: { id: input.id } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    if (row.code === '_tumbu_accounts') throw new BadRequestException('Control Plane tidak dapat diubah lewat endpoint ini.');
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (!String(input.name).trim()) throw new BadRequestException('Nama tidak boleh kosong.');
      data.name = String(input.name).trim();
    }
    if (input.phone !== undefined) data.phone = String(input.phone).trim() || null;
    if (input.address !== undefined) data.address = String(input.address).trim() || null;
    // Legacy toggle → map ke Approval Gate statuses
    if (typeof input.isActive === 'boolean') {
      const status: WorkspaceStatus = input.isActive ? 'ACTIVE' : 'SUSPENDED';
      data.status = status;
      data.isActive = isActiveForStatus(status);
    }
    if (input.blueprintId) {
      const bp = blueprintById(input.blueprintId);
      if (!bp.available) throw new BadRequestException('Blueprint belum tersedia.');
      data.blueprintId = bp.id;
      data.blueprint = bp.name;
      data.modulesJson = JSON.stringify(bp.modules);
    }
    const updated = await this.prisma.workspace.update({ where: { id: row.id }, data });
    await this.audit.log({
      action: typeof input.isActive === 'boolean'
        ? (input.isActive ? 'workspace.approve' : 'workspace.suspend')
        : 'workspace.update',
      tenantId: updated.id,
      entity: 'tenant',
      entityId: updated.id,
      meta: data,
    });
    return this.workspaces();
  }

  /** Approval Gate transitions — explicit workspaceId (tenant mutation rules). */
  async setWorkspaceStatus(input: {
    workspaceId?: string; status?: string; actorUserId?: string | null;
  } = {}) {
    if (!input.workspaceId?.trim()) {
      throw new BadRequestException('workspaceId wajib untuk mengubah status workspace.');
    }
    if (!isWorkspaceStatus(input.status)) {
      throw new BadRequestException('Status tidak valid. Gunakan PENDING, ACTIVE, REJECTED, atau SUSPENDED.');
    }
    const status = input.status as WorkspaceStatus;
    const row = await this.prisma.workspace.findUnique({ where: { id: String(input.workspaceId).trim() } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    if (row.code === '_tumbu_accounts') throw new BadRequestException('Control Plane tidak memakai alur persetujuan usaha.');

    const updated = await this.prisma.workspace.update({
      where: { id: row.id },
      data: {
        status,
        isActive: isActiveForStatus(status),
        graceUntil: status === 'GRACE' ? row.graceUntil : null,
      },
    });
    const action =
      status === 'ACTIVE' ? 'workspace.approve'
        : status === 'REJECTED' ? 'workspace.reject'
          : status === 'SUSPENDED' ? 'workspace.suspend'
            : status === 'GRACE' ? 'billing.grace'
              : 'workspace.status';
    await this.audit.log({
      action,
      userId: input.actorUserId || null,
      tenantId: updated.id,
      entity: 'tenant',
      entityId: updated.id,
      meta: { from: row.status, to: status, workspaceName: updated.name },
    });
    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status,
      statusLabel: labelWorkspaceStatus(updated.status),
      isActive: updated.isActive,
    };
  }

  async approveWorkspace(input: { workspaceId?: string } = {}, token?: string) {
    const actorUserId = token ? (await this.auth.requireSession(token)).userId : null;
    const result = await this.setWorkspaceStatus({ workspaceId: input.workspaceId, status: 'ACTIVE', actorUserId });
    try {
      await this.applyRegistrationRequestOnApprove(result.id);
    } catch { /* plan dari create sudah ada — jangan gagalkan approve */ }
    let pin = { updatedSessions: 0, updatedUsers: 0 };
    try {
      pin = await this.auth.pinOwnersToWorkspace(result.id);
    } catch { /* ignore pin failure */ }
    await this.audit.log({
      action: 'workspace.approve_redirect',
      userId: actorUserId,
      tenantId: result.id,
      entity: 'tenant',
      entityId: result.id,
      meta: pin,
    });
    return { ...result, sessionPin: pin };
  }

  /** Pastikan plan + allowedSpecies dari pengajuan registrasi diterapkan saat approve. */
  private async applyRegistrationRequestOnApprove(workspaceId: string) {
    const row = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!row || row.code === '_tumbu_accounts') return;
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(row.settingsJson || '{}') as Record<string, unknown>; } catch { /* ignore */ }
    const req = (settings.registrationRequest && typeof settings.registrationRequest === 'object')
      ? settings.registrationRequest as Record<string, unknown>
      : null;
    if (!req) return;

    const planIdOrCode = String(req.planId || req.planCode || '').trim();
    if (planIdOrCode) {
      const plan = await this.resolvePlan(planIdOrCode);
      if (row.planId !== plan.id) {
        await this.assignWorkspacePlan({ workspaceId, planId: plan.id });
      }
    }

    const species = Array.isArray(req.allowedSpecies)
      ? req.allowedSpecies.map((x) => normalizeSpeciesCode(x)).filter(Boolean)
      : [];
    const tier = String(req.speciesTier || settings.speciesTier || 'single').toLowerCase() === 'multi'
      ? 'multi'
      : 'single';
    const nextSpecies = tier === 'single' ? species.slice(0, 1) : species;
    settings.allowedSpecies = nextSpecies;
    settings.speciesTier = tier;
    settings.registrationRequest = {
      ...req,
      approvedAt: new Date().toISOString(),
      allowedSpecies: nextSpecies,
      speciesTier: tier,
    };
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settingsJson: JSON.stringify(settings) },
    });
  }

  /** Katalog paket untuk self-serve registrasi (tanpa role Founder). */
  async catalogPlans() {
    return [
      { id: 'plan-free', code: 'FREE_STARTER', name: 'Gratis', monthlyAmount: 0, isActive: true },
      { id: 'plan-pro', code: 'PRO_GROWER', name: 'Pro Grower', monthlyAmount: 100000, isActive: true }
    ];
  }

  async rejectWorkspace(input: { workspaceId?: string } = {}, token?: string) {
    const actorUserId = token ? (await this.auth.requireSession(token)).userId : null;
    return this.setWorkspaceStatus({ workspaceId: input.workspaceId, status: 'REJECTED', actorUserId });
  }

  async suspendWorkspace(input: { workspaceId?: string } = {}, token?: string) {
    const actorUserId = token ? (await this.auth.requireSession(token)).userId : null;
    return this.setWorkspaceStatus({ workspaceId: input.workspaceId, status: 'SUSPENDED', actorUserId });
  }

  async activateWorkspace(input: { id?: string } = {}, token?: string) {
    if (!input.id) throw new BadRequestException('ID workspace wajib diisi.');
    const row = await this.prisma.workspace.findUnique({ where: { id: input.id } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    const session = token ? await this.auth.requireSession(token) : null;
    if (session && !session.isPlatformAdmin) {
      if (!canMemberEnterWorkspace(row.status, false)) {
        throw new BadRequestException(
          `Workspace belum dapat dimasuki (status: ${labelWorkspaceStatus(row.status)}).`,
        );
      }
      const mem = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { userId: session.userId, workspaceId: row.id } },
      });
      if (!mem) throw new BadRequestException('Anda tidak memiliki akses ke workspace ini.');
      await this.auth.switchTenant(token, row.id, mem.role);
    } else if (session) {
      await this.auth.switchTenant(token, row.id, 'PLATFORM_ADMIN');
    }
    return this.tenant.run(row.id, () => this.openContext(), session?.userId);
  }

  /** Pin session kembali ke tenant Control Plane (`_tumbu_accounts`). */
  async enterControlPlane(token?: string) {
    const session = await this.auth.requireSession(token);
    if (!session.isPlatformAdmin) {
      throw new BadRequestException('Hanya Platform Admin yang dapat masuk Control Plane.');
    }
    const accounts = await this.auth.ensureAccountsTenant();
    await this.auth.switchTenant(token, accounts.id, 'PLATFORM_ADMIN');
    return {
      tenantId: accounts.id,
      code: accounts.code,
      name: accounts.name,
      land: 'platform' as const,
    };
  }

  async openContext() {
    const t = await this.tenantRow();
    const bp = blueprintById(t.blueprintId);
    let modules = this.parseModules(t.modulesJson, t.blueprintId);
    const demo = isDemoMode(t.settingsJson);
    let planPayload: {
      id: string | null;
      code: string;
      name: string;
      limits: ReturnType<typeof resolvePlanLimits>;
    } | null = null;
    if (t.planId) {
      const plan = await this.prisma.platformPlan.findUnique({ where: { id: t.planId } });
      if (plan) {
        if (!demo) modules = intersectModules(modules, parsePlanModules(plan.modulesJson));
        planPayload = {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          limits: resolvePlanLimits(plan.code),
        };
      }
    }
    if (!planPayload) {
      planPayload = {
        id: null,
        code: 'starter',
        name: 'Starter',
        limits: resolvePlanLimits('starter'),
      };
    }
    const pages = [...new Set(modules.flatMap((id) => (MODULE_REGISTRY.find((m) => m.id === id)?.pages ?? [])))];
    if (!pages.includes('dashboard')) pages.unshift('dashboard');
    if (modules.includes('cash') && !pages.includes('kwitansi')) pages.push('kwitansi');
    let logoUrl = '';
    let tagline = '';
    let allowedSpecies: string[] = [];
    let speciesTier: 'single' | 'multi' = 'single';
    try {
      const parsed = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>;
      if (typeof parsed.logoUrl === 'string') logoUrl = parsed.logoUrl;
      if (typeof parsed.tagline === 'string') tagline = parsed.tagline;
      allowedSpecies = parseAllowedSpecies(t.settingsJson);
      if (String(parsed.speciesTier || '').toLowerCase() === 'multi') speciesTier = 'multi';
    } catch { /* settings kosong / invalid — biarkan default */ }
    return {
      workspace: {
        id: t.id, code: t.code, name: t.name, phone: t.phone, address: t.address,
        isActive: t.isActive, status: t.status,
        planId: t.planId, trialEndsAt: t.trialEndsAt?.toISOString() || null,
        commercialStatus: t.commercialStatus,
        logoUrl: logoUrl || null,
        tagline: tagline || null,
      },
      plan: planPayload,
      blueprint: { id: bp.id, name: bp.name, category: bp.category, categoryLabel: bp.categoryLabel, kind: bp.kind },
      modules, pages,
      allowedSpecies,
      speciesTier,
      speciesOptions: SPECIES_LICENSE_OPTIONS,
      onboardingSteps: this.onboardingSteps(bp.id),
    };
  }

  /** Filter Context: update allowedSpecies di settingsJson (merge non-destructive). */
  async updateFilterContext(input: {
    allowedSpecies?: string[]; primarySpecies?: string; merge?: boolean;
  } = {}) {
    const t = await this.tenantRow();
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>; } catch { /* ignore */ }
    const incoming = this.resolveAllowedSpeciesInput(input.allowedSpecies, input.primarySpecies);
    if (input.allowedSpecies !== undefined || input.primarySpecies !== undefined) {
      const prev = parseAllowedSpecies(t.settingsJson);
      const merge = input.merge !== false; // default merge
      settings.allowedSpecies = merge
        ? [...new Set([...prev, ...incoming])]
        : incoming;
    }
    await this.prisma.workspace.update({
      where: { id: t.id },
      data: { settingsJson: JSON.stringify(settings) },
    });
    await this.audit.log({
      action: 'workspace.filter_context',
      tenantId: t.id,
      entity: 'tenant',
      entityId: t.id,
      meta: { allowedSpecies: settings.allowedSpecies },
    });
    return {
      allowedSpecies: parseAllowedSpecies(JSON.stringify(settings)),
      speciesOptions: SPECIES_LICENSE_OPTIONS,
    };
  }

  private resolveAllowedSpeciesInput(allowed?: string[], primary?: string): string[] {
    const fromList = Array.isArray(allowed)
      ? allowed.map((x) => normalizeSpeciesCode(x)).filter(Boolean)
      : [];
    const fromPrimary = primary ? [normalizeSpeciesCode(primary)].filter(Boolean) : [];
    return [...new Set([...fromList, ...fromPrimary])];
  }

  async blueprints(workspaceId?: string) {
    return [
      { id: 'blueprint-a', name: 'Budidaya Ikan Air Tawar (Pembudidaya)', category: 'cultivator', categoryLabel: 'Cultivator OS', description: 'Sistem manajemen operasional budidaya ikan.', kind: 'core', available: true, active: true },
      { id: 'blueprint-b', name: 'Distribusi & Penjualan Ikan (Distributor)', category: 'trading', categoryLabel: 'Trading OS', description: 'Sistem manajemen inventori dan penjualan ikan.', kind: 'core', available: true, active: false }
    ];
  }

  async activateBlueprint(input: { id?: string; workspaceId?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID blueprint wajib diisi.');
    const bp = BLUEPRINTS.find((b) => b.id === input.id);
    if (!bp || !isSelectableBlueprint(bp)) throw new BadRequestException('Blueprint tidak tersedia.');
    const t = await this.requireWorkspaceRow(input.workspaceId);
    await this.prisma.workspace.update({
      where: { id: t.id },
      data: { blueprintId: bp.id, blueprint: bp.name, modulesJson: JSON.stringify(bp.modules) },
    });
    await this.audit.log({ action: 'blueprint.activate', tenantId: t.id, entity: 'blueprint', entityId: bp.id });
    return this.blueprints(t.id);
  }

  async setDemoMode(input: { workspaceId?: string; enabled?: boolean } = {}) {
    if (!input.workspaceId?.trim()) throw new BadRequestException('workspaceId wajib.');
    if (typeof input.enabled !== 'boolean') throw new BadRequestException('enabled (boolean) wajib.');
    const t = await this.requireWorkspaceRow(input.workspaceId);
    if (t.code === '_tumbu_accounts') throw new BadRequestException('Control Plane tidak dapat diberi demo mode.');
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>; } catch { /* ignore */ }
    settings.demoMode = input.enabled;
    await this.prisma.workspace.update({
      where: { id: t.id },
      data: { settingsJson: JSON.stringify(settings) },
    });
    await this.audit.log({
      action: input.enabled ? 'demo_mode.enable' : 'demo_mode.disable',
      tenantId: t.id,
      entity: 'tenant',
      entityId: t.id,
      meta: { demoMode: input.enabled },
    });
    return { workspaceId: t.id, workspaceCode: t.code, demoMode: input.enabled };
  }

  async settings(workspaceId?: string) {
    const t = await this.requireWorkspaceRow(workspaceId);
    const bp = blueprintById(t.blueprintId);
    return {
      name: t.name, code: t.code, phone: t.phone ?? '', address: t.address ?? '',
      timezone: t.timezone, locale: t.locale, blueprintId: t.blueprintId, blueprintName: bp.name, isActive: t.isActive,
      workspaceId: t.id,
    };
  }

  async updateSettings(input: {
    name?: string; phone?: string; address?: string; timezone?: string; locale?: string; workspaceId?: string;
  } = {}) {
    if (input.name !== undefined && !String(input.name).trim()) throw new BadRequestException('Nama workspace tidak boleh kosong.');
    const t = await this.requireWorkspaceRow(input.workspaceId);
    await this.prisma.workspace.update({
      where: { id: t.id },
      data: {
        ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
        ...(input.phone !== undefined ? { phone: String(input.phone).trim() || null } : {}),
        ...(input.address !== undefined ? { address: String(input.address).trim() || null } : {}),
        ...(input.timezone !== undefined ? { timezone: String(input.timezone).trim() || 'Asia/Jakarta' } : {}),
        ...(input.locale !== undefined ? { locale: String(input.locale).trim() || 'id-ID' } : {}),
      },
    });
    await this.audit.log({ action: 'settings.update', tenantId: t.id, entity: 'tenant', entityId: t.id });
    return this.settings(t.id);
  }

  async listMembers() {
    const rows = await this.prisma.workspaceMember.findMany({
      include: {
        user: { select: { id: true, email: true, fullName: true, isPlatformAdmin: true } },
        workspace: { select: { id: true, name: true, slug: true, businessType: true } },
      },
      orderBy: [{ workspaceId: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      email: m.user.email,
      name: m.user.fullName,
      isPlatformAdmin: m.user.isPlatformAdmin,
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.name,
      workspaceCode: m.workspace.slug,
      blueprintId: m.workspace.businessType,
    }));
  }

  async createMember(input: {
    email?: string; name?: string; password?: string; role?: string; workspaceId?: string;
  } = {}) {
    if (!input.email?.trim() || !input.name?.trim() || !input.workspaceId) {
      throw new BadRequestException('Email, nama, dan workspace wajib.');
    }
    const roleInput = (input.role || 'STAFF').toUpperCase();
    const resolvedRole = roleInput === 'OWNER' ? 'OWNER' : 'OPERATOR';
    const ws = await this.prisma.workspace.findUnique({ where: { id: input.workspaceId } });
    if (!ws) throw new BadRequestException('Workspace tidak ditemukan.');
    const passwordHash = hashPassword(input.password || process.env.DEMO_USER_PASSWORD || 'TumbuDemo123!');
    const email = input.email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, fullName: input.name.trim(), role: resolvedRole, passwordHash },
      });
    } else {
      // Jangan overwrite password akun yang sudah ada (undang ke workspace lain).
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fullName: input.name.trim() },
      });
    }
    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { userId: user.id, workspaceId: ws.id } },
      update: { role: resolvedRole },
      create: { userId: user.id, workspaceId: ws.id, role: resolvedRole },
    });
    await this.audit.log({
      action: 'member.create',
      tenantId: ws.id,
      entity: 'membership',
      entityId: user.id,
      meta: { email, role: resolvedRole },
    });
    return this.listMembers();
  }

  async updateMember(input: { id?: string; role?: string; active?: boolean } = {}) {
    if (!input.id) throw new BadRequestException('ID membership wajib.');
    const mem = await this.prisma.workspaceMember.findUnique({ where: { id: input.id } });
    if (!mem) throw new BadRequestException('Membership tidak ditemukan.');
    if (input.role) {
      const resolvedRole = input.role.toUpperCase() === 'OWNER' ? 'OWNER' : 'OPERATOR';
      await this.prisma.workspaceMember.update({ where: { id: mem.id }, data: { role: resolvedRole } });
      await this.audit.log({
        action: 'member.role_change',
        tenantId: mem.workspaceId,
        entity: 'membership',
        entityId: mem.id,
        meta: { role: resolvedRole },
      });
    }
    if (input.active === false) {
      await this.prisma.workspaceMember.delete({ where: { id: mem.id } });
      await this.audit.log({
        action: 'member.remove',
        tenantId: mem.workspaceId,
        entity: 'membership',
        entityId: mem.id,
      });
    }
    return this.listMembers();
  }

  async listLeads() {
    const rows = (this.prisma as any).interestLead ? await (this.prisma as any).interestLead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) : [];
    return rows.map((r) => ({
      id: r.id, name: r.name, businessName: r.businessName, phone: r.phone, email: r.email,
      notes: r.notes, status: r.status,
      convertedTenantId: r.convertedTenantId || null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async updateLead(input: { id?: string; status?: string } = {}) {
    if (!input.id || !input.status) throw new BadRequestException('ID dan status wajib.');
    const status = input.status.toUpperCase();
    if (!['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'].includes(status)) throw new BadRequestException('Status tidak valid.');
    await this.prisma.interestLead.update({ where: { id: input.id }, data: { status } });
    return this.listLeads();
  }

  /**
   * Lead → Workspace: QUALIFIED lead becomes PENDING workspace + OWNER membership.
   * Does not auto-approve (Approval Gate remains).
   */
  async convertLead(input: {
    leadId?: string; blueprintId?: string; planId?: string; code?: string;
  } = {}) {
    if (!input.leadId?.trim()) throw new BadRequestException('leadId wajib.');
    const lead = await this.prisma.interestLead.findUnique({ where: { id: String(input.leadId).trim() } });
    if (!lead) throw new BadRequestException('Lead tidak ditemukan.');
    if (lead.convertedTenantId) {
      throw new BadRequestException('Lead sudah dikonversi ke workspace.');
    }
    const st = String(lead.status || '').toUpperCase();
    if (st !== 'QUALIFIED' && st !== 'CONTACTED') {
      throw new BadRequestException('Hanya lead CONTACTED atau QUALIFIED yang dapat dikonversi.');
    }

    const tempPassword = `Tumbu${Date.now().toString(36).slice(-6)}!`;
    const workspace = await this.createWorkspace({
      name: lead.businessName,
      code: input.code,
      blueprintId: input.blueprintId || DEFAULT_BLUEPRINT_ID,
      planId: input.planId || DEFAULT_PLAN_CODE,
      phone: lead.phone || undefined,
      ownerName: lead.name,
      ownerEmail: lead.email,
      ownerPassword: tempPassword,
    });

    await this.prisma.interestLead.update({
      where: { id: lead.id },
      data: { status: 'CLOSED', convertedTenantId: workspace.id },
    });

    await this.audit.log({
      action: 'lead.convert',
      tenantId: workspace.id,
      entity: 'InterestLead',
      entityId: lead.id,
      meta: {
        workspaceId: workspace.id,
        workspaceCode: workspace.code,
        email: lead.email,
        status: 'PENDING',
      },
    });

    return {
      leadId: lead.id,
      leadStatus: 'CLOSED',
      workspace: {
        id: workspace.id,
        code: workspace.code,
        name: workspace.name,
        status: workspace.status,
        statusLabel: workspace.statusLabel,
        planCode: workspace.planCode,
        trialEndsAt: workspace.trialEndsAt,
      },
      owner: {
        email: lead.email,
        name: lead.name,
        temporaryPassword: tempPassword,
      },
      message: 'Workspace dibuat berstatus PENDING. Setujui di menu Workspace agar owner dapat masuk. Bagikan password sementara kepada owner.',
    };
  }

  async listAudit(limit?: number) {
    const rows = await this.audit.list(limit);
    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))] as string[];
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    type TenantLite = { id: string; name: string; code: string };
    type UserLite = { id: string; name: string | null; email: string };
    const tenants: TenantLite[] = tenantIds.length
      ? await this.prisma.workspace.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, code: true },
      })
      : [];
    const users: UserLite[] = userIds.length
      ? await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
      : [];
    const tenantMap = new Map<string, TenantLite>(tenants.map((t) => [t.id, t]));
    const userMap = new Map<string, UserLite>(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const meta = (r.meta || {}) as Record<string, unknown>;
      const tenant = r.tenantId ? tenantMap.get(r.tenantId) : undefined;
      const workspaceName =
        (typeof meta.workspaceName === 'string' && meta.workspaceName)
        || tenant?.name
        || null;
      const user = r.userId ? userMap.get(r.userId) : undefined;
      const actorLabel = user
        ? (user.name || user.email || 'Pengguna')
        : 'Sistem';
      const actionLabel = labelAuditAction(r.action);
      const summary = summarizeAuditEvent({
        action: r.action,
        workspaceName,
        meta,
      });
      return {
        ...r,
        actionLabel,
        summary,
        workspaceName,
        workspaceCode: tenant?.code || null,
        actorLabel,
        actorIsSystem: !r.userId,
      };
    });
  }

  private money(n: number) {
    return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
  }

  private esc(v: unknown) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // All billing and invoice features have been removed or migrated.
  // These stubs prevent the Control Center UI from crashing with 500 errors.
  async billingProfile() {
    return {
      id: 'default', legalName: '', tagline: '', address: '', phone: '', email: '', npwp: '',
      bankName: '', bankAccount: '', bankHolder: '', defaultPlanName: '', defaultAmount: 0,
      dueDays: 0, graceDays: 0, remindBeforeDays: 0, updatedAt: new Date().toISOString()
    };
  }
  async updateBillingProfile(input: any) { return this.billingProfile(); }
  async listBillingInvoices() { return []; }
  async generateBillingInvoices(input: any) { return { periodYm: input?.periodYm, created: [], skipped: [] }; }
  async enforceBilling(input: any) { return { overdue: 0, suspended: 0, grace: 0 }; }
  async runBillingReminders(input: any) { return { count: 0 }; }
  async verifyPaymentProof(input: any) { return {}; }
  async updateBillingInvoice(input: any) { return {}; }
  async billingInvoiceDocument(id: any) { return { html: '', number: '' }; }
  async ownerInvoices(token: any, workspaceId: any) { return { workspace: {}, invoices: [] }; }
  async ownerUploadProof(token: any, input: any) { return {}; }
  async ownerWorkspaces(token?: string) { return []; }
  async batchApproveWorkspaces(input: any, token?: string) { return {}; }
  async batchSuspendWorkspaces(input: any, token?: string) { return {}; }
}

