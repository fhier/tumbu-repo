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
import { resolvePlanLimits } from './plan-limits';
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
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: this.tenant.tryTenantId() } });
  }

  /**
   * Workspace bisnis eksplisit — wajib untuk operasi scoped (modul/blueprint/settings).
   * Tidak pernah fallback ke session.tenantId (hindari cross-tenant diam-diam).
   */
  private async requireWorkspaceRow(workspaceId?: string | null) {
    if (!workspaceId || !String(workspaceId).trim()) {
      throw new BadRequestException('workspaceId wajib untuk operasi workspace ini.');
    }
    const row = await this.prisma.tenant.findUnique({ where: { id: String(workspaceId).trim() } });
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
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: workspaceId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Anda tidak memiliki akses ke workspace ini.');
  }

  private parseModules(json: string, blueprintId?: string): string[] {
    return parseTenantModules(json, blueprintId);
  }

  async catalogBlueprints() {
    return BLUEPRINTS.filter(isPublicCatalogBlueprint).map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      categoryLabel: b.categoryLabel,
      description: b.description,
      kind: b.kind,
      available: b.available,
    }));
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
    const existing = await this.prisma.membership.findMany({
      where: { userId: session.userId, role: 'OWNER' },
      include: { tenant: { include: { plan: true } } },
    });
    const maxQuota = Math.max(
      plan.workspaceQuota,
      ...existing.map((m) => m.tenant.plan?.workspaceQuota || 1),
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

    await this.prisma.membership.upsert({
      where: { userId_tenantId: { userId: session.userId, tenantId: created.id } },
      update: { role: 'OWNER' },
      create: { userId: session.userId, tenantId: created.id, role: 'OWNER' },
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
    const memberCount = await this.prisma.membership.count({ where: { tenantId: created.id } });
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
    const t = await this.tenantRow();
    const onControlPlane = t.code === '_tumbu_accounts';
    const modules = onControlPlane ? [] : this.parseModules(t.modulesJson, t.blueprintId);
    const bp = blueprintById(t.blueprintId);
    const workspaces = await this.prisma.tenant.findMany({ orderBy: { name: 'asc' } });
    const memberCount = await this.prisma.membership.count();
    const leadCount = await this.prisma.interestLead.count({ where: { status: 'NEW' } });
    const business = workspaces.filter((w) => w.code !== '_tumbu_accounts');
    const pendingWorkspaceCount = business.filter((w) => w.status === 'PENDING').length;
    const activeWorkspaceCount = business.filter((w) => w.status === 'ACTIVE').length;
    const scopeId = onControlPlane ? null : t.id;
    const [productCount, partnerCount, txCount, baCount, woCount] = scopeId
      ? await Promise.all([
        this.prisma.product.count({ where: { tenantId: scopeId } }),
        this.prisma.partner.count({ where: { tenantId: scopeId } }),
        this.prisma.transaction.count({ where: { tenantId: scopeId } }),
        this.prisma.beritaAcara.count({ where: { tenantId: scopeId } }),
        this.prisma.workOrder.count({ where: { tenantId: scopeId } }),
      ])
      : [0, 0, 0, 0, 0];
    return {
      workspaceName: onControlPlane ? 'TUMBU Platform' : t.name,
      workspaceCode: onControlPlane ? 'control-plane' : t.code,
      blueprintName: onControlPlane ? 'Control Plane' : bp.name,
      blueprintId: onControlPlane ? '' : bp.id,
      categoryLabel: onControlPlane ? 'Platform' : bp.categoryLabel,
      moduleCount: modules.length, modules,
      workspaceCount: business.length,
      activeWorkspaceCount,
      pendingWorkspaceCount,
      memberCount, leadCount,
      workspaces: business.map((w) => ({
        id: w.id, name: w.name, code: w.code,
        blueprint: blueprintById(w.blueprintId).name, blueprintId: w.blueprintId,
        isCurrent: !onControlPlane && w.id === t.id, isActive: w.isActive,
        status: w.status, statusLabel: labelWorkspaceStatus(w.status),
        updatedAt: w.updatedAt.toISOString(),
      })),
      productCount, partnerCount, transactionCount: txCount, beritaAcaraCount: baCount, workOrderCount: woCount,
      timezone: t.timezone,
      status: onControlPlane ? 'Control Plane' : labelWorkspaceStatus(t.status),
      compatibilityOk: true,
      updatedAt: t.updatedAt.toISOString(),
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
    const t = await this.requireWorkspaceRow(workspaceId);
    const enabled = new Set(this.parseModules(t.modulesJson, t.blueprintId));
    const allowed = new Set(modulesForBlueprint(t.blueprintId));
    let planAllowed: Set<string> | null = null;
    if (t.planId) {
      const plan = await this.prisma.platformPlan.findUnique({ where: { id: t.planId } });
      if (plan) planAllowed = new Set(parsePlanModules(plan.modulesJson));
    }
    return MODULE_REGISTRY.filter((m) => allowed.has(m.id) || enabled.has(m.id)).map((m) => ({
      ...m,
      enabled: enabled.has(m.id),
      planAllowed: planAllowed ? planAllowed.has(m.id) : true,
      layerLabel: 'Operasional',
      statusLabel: m.status === 'stable' ? 'Stabil' : 'Pratinjau',
      workspaceId: t.id,
      workspaceCode: t.code,
      workspaceName: t.name,
    }));
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
    await this.prisma.tenant.update({ where: { id: t.id }, data: { modulesJson: JSON.stringify([...set]) } });
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
    return this.prisma.membership.count({
      where: {
        userId,
        role: 'OWNER',
        tenant: { code: { not: '_tumbu_accounts' }, status: { not: 'REJECTED' } },
      },
    });
  }

  async assignWorkspacePlan(input: { workspaceId?: string; planId?: string } = {}) {
    if (!input.workspaceId?.trim()) throw new BadRequestException('workspaceId wajib.');
    const plan = await this.resolvePlan(input.planId);
    const row = await this.prisma.tenant.findUnique({ where: { id: String(input.workspaceId).trim() } });
    if (!row || row.code === '_tumbu_accounts') throw new BadRequestException('Workspace tidak ditemukan.');
    const bp = blueprintById(row.blueprintId);
    const planMods = parsePlanModules(plan.modulesJson);
    const nextModules = intersectModules(bp.modules, planMods);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);
    const updated = await this.prisma.tenant.update({
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
    await this.ensurePlans();
    const rows = await this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: { plan: true },
    });
    const counts = await this.prisma.membership.groupBy({ by: ['tenantId'], _count: { _all: true } });
    const map = new Map(counts.map((c) => [c.tenantId, c._count._all]));
    return rows
      .filter((t) => t.code !== '_tumbu_accounts')
      .map((t) => ({
      id: t.id, code: t.code, name: t.name,
      blueprint: blueprintById(t.blueprintId).name, blueprintId: t.blueprintId,
      isCurrent: t.id === this.tenant.tryTenantId(),
      isActive: t.isActive,
      status: t.status,
      statusLabel: labelWorkspaceStatus(t.status),
      memberCount: map.get(t.id) || 0,
      phone: t.phone, address: t.address,
      planId: t.planId,
      planCode: t.plan?.code || null,
      planName: t.plan?.name || null,
      trialEndsAt: t.trialEndsAt?.toISOString() || null,
      commercialStatus: t.commercialStatus,
      demoMode: isDemoMode(t.settingsJson),
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
    if (await this.prisma.tenant.findUnique({ where: { code } })) throw new BadRequestException('Kode workspace sudah dipakai.');
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
    const created = await this.prisma.tenant.create({
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

    const memberCount = await this.prisma.membership.count({ where: { tenantId: created.id } });

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
    await this.prisma.tenant.update({
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
    const row = await this.prisma.tenant.findUnique({ where: { id: input.id } });
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
    const updated = await this.prisma.tenant.update({ where: { id: row.id }, data });
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
    const row = await this.prisma.tenant.findUnique({ where: { id: String(input.workspaceId).trim() } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    if (row.code === '_tumbu_accounts') throw new BadRequestException('Control Plane tidak memakai alur persetujuan usaha.');

    const updated = await this.prisma.tenant.update({
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
    const row = await this.prisma.tenant.findUnique({ where: { id: workspaceId } });
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
    await this.prisma.tenant.update({
      where: { id: workspaceId },
      data: { settingsJson: JSON.stringify(settings) },
    });
  }

  /** Katalog paket untuk self-serve registrasi (tanpa role Founder). */
  async catalogPlans() {
    const rows = await this.ensurePlans();
    return rows.filter((p) => p.isActive).map((p) => this.mapPlan(p));
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
    const row = await this.prisma.tenant.findUnique({ where: { id: input.id } });
    if (!row) throw new BadRequestException('Workspace tidak ditemukan.');
    const session = token ? await this.auth.requireSession(token) : null;
    if (session && !session.isPlatformAdmin) {
      if (!canMemberEnterWorkspace(row.status, false)) {
        throw new BadRequestException(
          `Workspace belum dapat dimasuki (status: ${labelWorkspaceStatus(row.status)}).`,
        );
      }
      // Trial & Plan: trial habis tanpa langganan → blokir (kecuali demo mode aktif)
      if (
        !isDemoMode(row.settingsJson) &&
        row.commercialStatus !== 'SUBSCRIBED' &&
        row.trialEndsAt &&
        row.trialEndsAt < new Date()
      ) {
        if (row.commercialStatus !== 'EXPIRED') {
          await this.prisma.tenant.update({
            where: { id: row.id },
            data: { commercialStatus: 'EXPIRED' },
          });
        }
        throw new BadRequestException(
          'Masa trial telah berakhir. Hubungi Platform Founder atau selesaikan tagihan untuk melanjutkan.',
        );
      }
      const mem = await this.prisma.membership.findUnique({
        where: { userId_tenantId: { userId: session.userId, tenantId: row.id } },
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
    await this.prisma.tenant.update({
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
    // Tanpa workspaceId: katalog saja (active=false) — tidak baca session.tenantId.
    let t: { id: string; code: string; name: string; blueprintId: string } | null = null;
    if (workspaceId && String(workspaceId).trim()) {
      const requestedWorkspaceId = String(workspaceId).trim();
      await this.assertWorkspaceAccess(requestedWorkspaceId);
      t = await this.requireWorkspaceRow(requestedWorkspaceId);
    }
    return BLUEPRINTS.filter(isPublicCatalogBlueprint).map((b) => ({
      ...b,
      active: t ? t.blueprintId === b.id : false,
      available: b.available,
      moduleList: b.modules,
      workspaceId: t?.id,
      workspaceCode: t?.code,
      workspaceName: t?.name,
    }));
  }

  async activateBlueprint(input: { id?: string; workspaceId?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID blueprint wajib diisi.');
    const bp = BLUEPRINTS.find((b) => b.id === input.id);
    if (!bp || !isSelectableBlueprint(bp)) throw new BadRequestException('Blueprint tidak tersedia.');
    const t = await this.requireWorkspaceRow(input.workspaceId);
    await this.prisma.tenant.update({
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
    await this.prisma.tenant.update({
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
    await this.prisma.tenant.update({
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
    const rows = await this.prisma.membership.findMany({
      include: {
        user: { select: { id: true, email: true, name: true, isPlatformAdmin: true } },
        tenant: { select: { id: true, name: true, code: true, blueprintId: true } },
      },
      orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      isPlatformAdmin: m.user.isPlatformAdmin,
      workspaceId: m.tenant.id,
      workspaceName: m.tenant.name,
      workspaceCode: m.tenant.code,
      blueprintId: m.tenant.blueprintId,
    }));
  }

  async createMember(input: {
    email?: string; name?: string; password?: string; role?: string; workspaceId?: string;
  } = {}) {
    if (!input.email?.trim() || !input.name?.trim() || !input.workspaceId) {
      throw new BadRequestException('Email, nama, dan workspace wajib.');
    }
    const role = (input.role || 'STAFF').toUpperCase();
    if (!['OWNER', 'ADMIN', 'STAFF', 'TECHNICIAN'].includes(role)) {
      throw new BadRequestException('Role tidak valid.');
    }
    const ws = await this.prisma.tenant.findUnique({ where: { id: input.workspaceId } });
    if (!ws) throw new BadRequestException('Workspace tidak ditemukan.');
    const passwordHash = hashPassword(input.password || process.env.DEMO_USER_PASSWORD || 'TumbuDemo123!');
    const email = input.email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: input.name.trim(), role, tenantId: ws.id, passwordHash },
      });
    } else {
      // Jangan overwrite password akun yang sudah ada (undang ke workspace lain).
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: input.name.trim() },
      });
    }
    await this.prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: ws.id } },
      update: { role },
      create: { userId: user.id, tenantId: ws.id, role },
    });
    await this.audit.log({
      action: 'member.create',
      tenantId: ws.id,
      entity: 'membership',
      entityId: user.id,
      meta: { email, role },
    });
    return this.listMembers();
  }

  async updateMember(input: { id?: string; role?: string; active?: boolean } = {}) {
    if (!input.id) throw new BadRequestException('ID membership wajib.');
    const mem = await this.prisma.membership.findUnique({ where: { id: input.id } });
    if (!mem) throw new BadRequestException('Membership tidak ditemukan.');
    if (input.role) {
      const role = input.role.toUpperCase();
      if (!['OWNER', 'ADMIN', 'STAFF', 'TECHNICIAN'].includes(role)) throw new BadRequestException('Role tidak valid.');
      await this.prisma.membership.update({ where: { id: mem.id }, data: { role } });
      await this.audit.log({
        action: 'member.role_change',
        tenantId: mem.tenantId,
        entity: 'membership',
        entityId: mem.id,
        meta: { role },
      });
    }
    if (input.active === false) {
      await this.prisma.membership.delete({ where: { id: mem.id } });
      await this.audit.log({
        action: 'member.remove',
        tenantId: mem.tenantId,
        entity: 'membership',
        entityId: mem.id,
      });
    }
    return this.listMembers();
  }

  async listLeads() {
    const rows = await this.prisma.interestLead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
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
      ? await this.prisma.tenant.findMany({
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

  private async ensureBillingProfile() {
    return this.prisma.platformBillingProfile.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  private mapBillingProfile(p: Awaited<ReturnType<PlatformService['ensureBillingProfile']>>) {
    return {
      id: p.id,
      legalName: p.legalName,
      tagline: p.tagline,
      address: p.address,
      phone: p.phone,
      email: p.email,
      npwp: p.npwp || '',
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      bankHolder: p.bankHolder,
      defaultPlanName: p.defaultPlanName,
      defaultAmount: Number(p.defaultAmount),
      dueDays: p.dueDays,
      graceDays: p.graceDays,
      remindBeforeDays: p.remindBeforeDays,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async billingProfile() {
    return this.mapBillingProfile(await this.ensureBillingProfile());
  }

  async updateBillingProfile(input: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = {};
    const str = (k: string) => {
      if (input[k] !== undefined) data[k] = String(input[k] ?? '').trim();
    };
    str('legalName'); str('tagline'); str('address'); str('phone'); str('email'); str('npwp');
    str('bankName'); str('bankAccount'); str('bankHolder'); str('defaultPlanName');
    if (input.defaultAmount !== undefined) {
      const n = Number(input.defaultAmount);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Nominal paket tidak valid.');
      data.defaultAmount = n;
    }
    if (input.dueDays !== undefined) {
      const d = Number(input.dueDays);
      if (!Number.isFinite(d) || d < 1 || d > 90) throw new BadRequestException('Jatuh tempo 1–90 hari.');
      data.dueDays = Math.round(d);
    }
    if (input.graceDays !== undefined) {
      const g = Number(input.graceDays);
      if (!Number.isFinite(g) || g < 0 || g > 60) throw new BadRequestException('Masa tenggang 0–60 hari.');
      data.graceDays = Math.round(g);
    }
    if (input.remindBeforeDays !== undefined) {
      const r = Number(input.remindBeforeDays);
      if (!Number.isFinite(r) || r < 0 || r > 30) throw new BadRequestException('Reminder sebelum jatuh tempo 0–30 hari.');
      data.remindBeforeDays = Math.round(r);
    }
    await this.ensureBillingProfile();
    const updated = await this.prisma.platformBillingProfile.update({
      where: { id: 'default' },
      data,
    });
    await this.audit.log({ action: 'billing.profile_update', entity: 'PlatformBillingProfile', entityId: 'default' });
    return this.mapBillingProfile(updated);
  }

  private async nextInvoiceNumber(periodYm: string) {
    const prefix = `INV-PLT-${periodYm.replace('-', '')}-`;
    const last = await this.prisma.platformInvoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
    });
    const seq = last ? (Number(last.number.slice(-4)) || 0) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private mapInvoice(row: {
    id: string; number: string; tenantId: string; periodYm: string; planName: string;
    description: string | null; amount: { toString(): string } | number; status: string;
    issuedAt: Date; dueAt: Date | null; paidAt: Date | null; notes: string | null;
    createdAt: Date; updatedAt: Date;
    proofStatus?: string | null; proofFileName?: string | null; proofMime?: string | null;
    proofNote?: string | null; proofUploadedAt?: Date | null; proofPath?: string | null;
    paymentProvider?: string | null; paymentExternalId?: string | null;
    paymentProviderRef?: string | null; paymentCheckoutUrl?: string | null;
    paymentChannel?: string | null;
    tenant?: { name: string; code: string; status?: string };
  }) {
    const status = normalizeInvoiceStatus(row.status, row.dueAt);
    return {
      id: row.id,
      number: row.number,
      tenantId: row.tenantId,
      workspaceName: row.tenant?.name || '',
      workspaceCode: row.tenant?.code || '',
      workspaceStatus: row.tenant?.status || '',
      periodYm: row.periodYm,
      planName: row.planName,
      description: row.description || '',
      amount: Number(row.amount),
      status,
      issuedAt: row.issuedAt.toISOString(),
      dueAt: row.dueAt?.toISOString() || null,
      paidAt: row.paidAt?.toISOString() || null,
      notes: row.notes || '',
      proofStatus: row.proofStatus || 'NONE',
      proofFileName: row.proofFileName || '',
      proofMime: row.proofMime || '',
      proofNote: row.proofNote || '',
      proofUploadedAt: row.proofUploadedAt?.toISOString() || null,
      hasProof: !!(row.proofPath || row.proofFileName),
      paymentProvider: row.paymentProvider || null,
      paymentExternalId: row.paymentExternalId || null,
      paymentProviderRef: row.paymentProviderRef || null,
      paymentCheckoutUrl: row.paymentCheckoutUrl || null,
      paymentChannel: row.paymentChannel || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listBillingInvoices() {
    const rows = await this.prisma.platformInvoice.findMany({
      include: { tenant: { select: { name: true, code: true, status: true } } },
      orderBy: [{ periodYm: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((r) => this.mapInvoice(r));
  }

  async generateBillingInvoices(input: { periodYm?: string; tenantId?: string } = {}) {
    const profile = await this.ensureBillingProfile();
    const now = new Date();
    const periodYm = (input.periodYm || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(periodYm)) throw new BadRequestException('Format periode YYYY-MM.');

    const tenants = await this.prisma.tenant.findMany({
      where: input.tenantId
        ? { id: input.tenantId, code: { not: '_tumbu_accounts' } }
        : { status: { in: ['ACTIVE', 'GRACE'] }, code: { not: '_tumbu_accounts' } },
      include: { plan: true },
      orderBy: { name: 'asc' },
    });
    if (!tenants.length) throw new BadRequestException('Tidak ada workspace untuk ditagih.');

    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + profile.dueDays);
    const created: string[] = [];
    const skipped: string[] = [];

    for (const t of tenants) {
      const existing = await this.prisma.platformInvoice.findUnique({
        where: { tenantId_periodYm: { tenantId: t.id, periodYm } },
      });
      if (existing) {
        skipped.push(t.code);
        continue;
      }
      const planName = t.plan?.name || profile.defaultPlanName;
      const amount = t.plan ? Number(t.plan.monthlyAmount) : Number(profile.defaultAmount);
      const number = await this.nextInvoiceNumber(periodYm);
      const inv = await this.prisma.platformInvoice.create({
        data: {
          number,
          tenantId: t.id,
          periodYm,
          planName,
          description: `Langganan ${planName} periode ${periodYm} — workspace ${t.name}`,
          amount,
          status: 'UNPAID',
          issuedAt: now,
          dueAt,
        },
      });
      created.push(t.code);
      void workspaceNotifyEmails(this.prisma, t.id).then(async (recipients) => {
        for (const r of recipients) {
          await this.email.sendSafe({
            kind: 'INVOICE_CREATED',
            to: r.email,
            name: r.name,
            workspaceName: t.name,
            invoiceNumber: inv.number,
            amount: Number(inv.amount),
            dueAt: dueAt.toISOString(),
          });
        }
      }).catch(() => undefined);
    }

    await this.audit.log({
      action: 'billing.generate',
      entity: 'PlatformInvoice',
      meta: { periodYm, created: created.length, skipped: skipped.length },
    });

    return {
      periodYm,
      created: created.length,
      skipped: skipped.length,
      createdCodes: created,
      skippedCodes: skipped,
      invoices: await this.listBillingInvoices(),
    };
  }

  async updateBillingInvoice(input: {
    id?: string; status?: string; amount?: number; notes?: string; planName?: string; description?: string;
  } = {}) {
    if (!input.id) throw new BadRequestException('ID invoice wajib.');
    const row = await this.prisma.platformInvoice.findUnique({ where: { id: input.id } });
    if (!row) throw new BadRequestException('Invoice tidak ditemukan.');

    const data: Record<string, unknown> = {};
    if (input.planName !== undefined) data.planName = String(input.planName).trim() || row.planName;
    if (input.description !== undefined) data.description = String(input.description);
    if (input.notes !== undefined) data.notes = String(input.notes);
    if (input.amount !== undefined) {
      const n = Number(input.amount);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Nominal tidak valid.');
      data.amount = n;
    }
    if (input.status) {
      let status = input.status.toUpperCase();
      if (status === 'ISSUED' || status === 'DRAFT') status = 'UNPAID';
      if (!['UNPAID', 'PAID', 'OVERDUE', 'VOID'].includes(status)) {
        throw new BadRequestException('Status tidak valid. Gunakan UNPAID, PAID, atau OVERDUE.');
      }
      data.status = status;
      if (status === 'PAID') data.paidAt = new Date();
      if (status === 'UNPAID' && !row.issuedAt) data.issuedAt = new Date();
      if (status !== 'PAID') data.paidAt = null;
    }

    await this.prisma.platformInvoice.update({ where: { id: row.id }, data });
    await this.audit.log({
      action: 'billing.invoice_update',
      tenantId: row.tenantId,
      entity: 'PlatformInvoice',
      entityId: row.id,
      meta: { status: input.status },
    });

    // Paid → restore workspace if no remaining OVERDUE
    if (String(data.status || '').toUpperCase() === 'PAID') {
      await this.restoreWorkspaceAfterPaid(row.tenantId);
    }

    const updated = await this.prisma.platformInvoice.findUniqueOrThrow({
      where: { id: row.id },
      include: { tenant: { select: { name: true, code: true, status: true } } },
    });
    return this.mapInvoice(updated);
  }

  // ——— Portal Owner (thin UI over Billing Enforcement) ———

  private async requireOwnerMembership(token: string | undefined, workspaceId: string) {
    const session = await this.auth.requireSession(token);
    if (!workspaceId?.trim()) throw new BadRequestException('workspaceId wajib.');
    const ws = await this.prisma.tenant.findUnique({ where: { id: String(workspaceId).trim() } });
    if (!ws || ws.code === '_tumbu_accounts') throw new BadRequestException('Workspace tidak ditemukan.');
    if (session.isPlatformAdmin) {
      return { session, ws, role: 'PLATFORM_ADMIN' };
    }
    const mem = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: session.userId, tenantId: ws.id } },
    });
    if (!mem) throw new ForbiddenException('Anda tidak memiliki akses ke workspace ini.');
    const role = String(mem.role || '').toUpperCase();
    if (!['OWNER', 'ADMIN'].includes(role)) {
      throw new ForbiddenException('Hanya Owner/Admin workspace yang dapat mengakses Portal Owner.');
    }
    return { session, ws, role };
  }

  async ownerWorkspaces(token?: string) {
    const session = await this.auth.requireSession(token);
    if (session.isPlatformAdmin) {
      const rows = await this.prisma.tenant.findMany({
        where: { code: { not: '_tumbu_accounts' } },
        include: { plan: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((t) => ({
        id: t.id, code: t.code, name: t.name, blueprintId: t.blueprintId,
        blueprint: blueprintById(t.blueprintId).name,
        status: t.status, statusLabel: labelWorkspaceStatus(t.status),
        isActive: t.isActive, role: 'PLATFORM_ADMIN',
        graceUntil: t.graceUntil?.toISOString() || null,
        planCode: t.plan?.code || null, planName: t.plan?.name || null,
        trialEndsAt: t.trialEndsAt?.toISOString() || null,
        commercialStatus: t.commercialStatus,
      }));
    }
    const mems = await this.prisma.membership.findMany({
      where: { userId: session.userId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { tenant: { include: { plan: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return mems
      .filter((m) => m.tenant.code !== '_tumbu_accounts')
      .map((m) => ({
        id: m.tenant.id, code: m.tenant.code, name: m.tenant.name,
        blueprintId: m.tenant.blueprintId, blueprint: blueprintById(m.tenant.blueprintId).name,
        status: m.tenant.status, statusLabel: labelWorkspaceStatus(m.tenant.status),
        isActive: m.tenant.isActive, role: m.role,
        graceUntil: m.tenant.graceUntil?.toISOString() || null,
        planCode: m.tenant.plan?.code || null, planName: m.tenant.plan?.name || null,
        trialEndsAt: m.tenant.trialEndsAt?.toISOString() || null,
        commercialStatus: m.tenant.commercialStatus,
      }));
  }

  async ownerInvoices(token: string | undefined, workspaceId?: string) {
    const { ws } = await this.requireOwnerMembership(token, workspaceId || '');
    const rows = await this.prisma.platformInvoice.findMany({
      where: { tenantId: ws.id },
      include: { tenant: { select: { name: true, code: true, status: true } } },
      orderBy: [{ periodYm: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return {
      workspace: {
        id: ws.id, code: ws.code, name: ws.name,
        status: ws.status, statusLabel: labelWorkspaceStatus(ws.status),
        graceUntil: ws.graceUntil?.toISOString() || null,
      },
      invoices: rows.map((r) => this.mapInvoice(r)),
    };
  }

  async ownerUploadProof(
    token: string | undefined,
    input: {
      workspaceId?: string; invoiceId?: string; fileBase64?: string;
      fileName?: string; mime?: string; note?: string;
    } = {},
  ) {
    const { session, ws } = await this.requireOwnerMembership(token, input.workspaceId || '');
    if (!input.invoiceId?.trim()) throw new BadRequestException('invoiceId wajib.');
    const inv = await this.prisma.platformInvoice.findFirst({
      where: { id: String(input.invoiceId).trim(), tenantId: ws.id },
    });
    if (!inv) throw new BadRequestException('Invoice tidak ditemukan.');
    const payStatus = normalizeInvoiceStatus(inv.status, inv.dueAt);
    if (payStatus === 'PAID') throw new BadRequestException('Invoice sudah lunas.');
    if (!input.fileBase64?.trim()) throw new BadRequestException('File bukti wajib diunggah.');

    const raw = String(input.fileBase64).replace(/^data:[^;]+;base64,/, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('File base64 tidak valid.');
    }
    if (!buf.length || buf.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Ukuran bukti maksimal 5 MB.');
    }

    const fileName = String(input.fileName || 'bukti-transfer.jpg').replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);
    const ext = extname(fileName) || '.jpg';
    const dir = join(process.cwd(), 'storage', 'local', 'billing-proofs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const stored = `${inv.id}-${Date.now()}${ext}`;
    const full = join(dir, stored);
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(full);
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      stream.end(buf);
    });

    const updated = await this.prisma.platformInvoice.update({
      where: { id: inv.id },
      data: {
        proofStatus: 'SUBMITTED',
        proofPath: stored,
        proofFileName: fileName,
        proofMime: String(input.mime || 'application/octet-stream').slice(0, 120),
        proofNote: String(input.note || '').trim().slice(0, 500) || null,
        proofUploadedAt: new Date(),
      },
      include: { tenant: { select: { name: true, code: true, status: true } } },
    });
    await this.audit.log({
      action: 'billing.proof_upload',
      userId: session.userId,
      tenantId: ws.id,
      entity: 'PlatformInvoice',
      entityId: inv.id,
      meta: { fileName, bytes: buf.length },
    });
    return this.mapInvoice(updated);
  }

  /** Admin: approve proof → PAID (existing billing restore); reject → proof REJECTED. */
  async verifyPaymentProof(input: {
    workspaceId?: string; invoiceId?: string; approve?: boolean; notes?: string;
  } = {}) {
    if (!input.workspaceId?.trim()) throw new BadRequestException('workspaceId wajib.');
    if (!input.invoiceId?.trim()) throw new BadRequestException('invoiceId wajib.');
    const inv = await this.prisma.platformInvoice.findFirst({
      where: { id: String(input.invoiceId).trim(), tenantId: String(input.workspaceId).trim() },
    });
    if (!inv) throw new BadRequestException('Invoice tidak ditemukan.');

    if (input.approve === false) {
      const updated = await this.prisma.platformInvoice.update({
        where: { id: inv.id },
        data: {
          proofStatus: 'REJECTED',
          notes: input.notes !== undefined ? String(input.notes) : inv.notes,
        },
        include: { tenant: { select: { name: true, code: true, status: true } } },
      });
      await this.audit.log({
        action: 'billing.proof_reject',
        tenantId: inv.tenantId,
        entity: 'PlatformInvoice',
        entityId: inv.id,
      });
      return this.mapInvoice(updated);
    }

    if (!inv.proofPath && inv.proofStatus !== 'SUBMITTED') {
      throw new BadRequestException('Belum ada bukti pembayaran untuk diverifikasi.');
    }

    await this.prisma.platformInvoice.update({
      where: { id: inv.id },
      data: { proofStatus: 'VERIFIED' },
    });
    return this.updateBillingInvoice({
      id: inv.id,
      status: 'PAID',
      notes: input.notes !== undefined ? String(input.notes) : inv.notes || undefined,
    });
  }

  /** After payment: always SUBSCRIBED; GRACE/SUSPENDED → ACTIVE. */
  private async restoreWorkspaceAfterPaid(tenantId: string) {
    const open = await this.prisma.platformInvoice.findMany({
      where: { tenantId, status: { in: ['UNPAID', 'OVERDUE', 'ISSUED'] } },
    });
    const stillOverdue = open.some((inv) => normalizeInvoiceStatus(inv.status, inv.dueAt) === 'OVERDUE');
    if (stillOverdue) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.code === '_tumbu_accounts') return;

    const data: {
      commercialStatus: string;
      status?: string;
      isActive?: boolean;
      graceUntil?: null;
    } = { commercialStatus: 'SUBSCRIBED' };

    if (tenant.status === 'GRACE' || tenant.status === 'SUSPENDED') {
      data.status = 'ACTIVE';
      data.isActive = true;
      data.graceUntil = null;
    }

    await this.prisma.tenant.update({ where: { id: tenantId }, data });
    await this.audit.log({
      action: 'billing.restore',
      tenantId,
      entity: 'tenant',
      entityId: tenantId,
      meta: {
        from: tenant.status,
        to: data.status || tenant.status,
        commercialStatus: 'SUBSCRIBED',
        workspaceName: tenant.name,
      },
    });
  }

  /**
   * Billing Enforcement (manual, no cron):
   * 1) Persist UNPAID past due → OVERDUE
   * 2) ACTIVE + OVERDUE → GRACE (set graceUntil)
   * 3) GRACE past graceUntil + still OVERDUE → SUSPENDED
   */
  async enforceBilling(input: { workspaceId?: string } = {}) {
    const profile = await this.ensureBillingProfile();
    const now = new Date();
    const workspaceFilter = input.workspaceId?.trim()
      ? { id: String(input.workspaceId).trim() }
      : { code: { not: '_tumbu_accounts' } };

    // 1) Mark overdue in DB
    const candidates = await this.prisma.platformInvoice.findMany({
      where: {
        status: { in: ['UNPAID', 'ISSUED', 'OVERDUE'] },
        ...(input.workspaceId?.trim() ? { tenantId: String(input.workspaceId).trim() } : {}),
      },
    });
    let markedOverdue = 0;
    const overdueInvoiceIds: string[] = [];
    for (const inv of candidates) {
      const norm = normalizeInvoiceStatus(inv.status, inv.dueAt, now);
      if (norm === 'OVERDUE' && inv.status !== 'OVERDUE') {
        await this.prisma.platformInvoice.update({
          where: { id: inv.id },
          data: { status: 'OVERDUE' },
        });
        markedOverdue += 1;
        overdueInvoiceIds.push(inv.id);
      }
    }

    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...workspaceFilter,
        status: { in: ['ACTIVE', 'GRACE'] },
      },
    });

    const toGrace: string[] = [];
    const toSuspend: string[] = [];
    const graceTenantIds: string[] = [];
    const suspendTenantIds: string[] = [];

    for (const t of tenants) {
      const overdue = await this.prisma.platformInvoice.count({
        where: { tenantId: t.id, status: 'OVERDUE' },
      });
      if (!overdue) continue;

      if (t.status === 'ACTIVE') {
        const graceUntil = new Date(now);
        graceUntil.setDate(graceUntil.getDate() + profile.graceDays);
        await this.prisma.tenant.update({
          where: { id: t.id },
          data: { status: 'GRACE', isActive: true, graceUntil },
        });
        await this.audit.log({
          action: 'billing.grace',
          tenantId: t.id,
          entity: 'tenant',
          entityId: t.id,
          meta: { graceUntil: graceUntil.toISOString(), overdue, workspaceName: t.name },
        });
        toGrace.push(t.code);
        graceTenantIds.push(t.id);
      } else if (t.status === 'GRACE') {
        const expired = !t.graceUntil || t.graceUntil <= now;
        if (expired) {
          await this.prisma.tenant.update({
            where: { id: t.id },
            data: { status: 'SUSPENDED', isActive: false },
          });
          await this.audit.log({
            action: 'billing.suspend',
            tenantId: t.id,
            entity: 'tenant',
            entityId: t.id,
            meta: { graceUntil: t.graceUntil?.toISOString() || null, overdue, workspaceName: t.name },
          });
          toSuspend.push(t.code);
          suspendTenantIds.push(t.id);
        }
      }
    }

    // Reminder hooks (idempotent — non-blocking for billing)
    for (const invoiceId of overdueInvoiceIds) {
      const inv = candidates.find((c) => c.id === invoiceId);
      if (inv) {
        await this.reminders.notifyTransition({
          kind: 'ON_OVERDUE', tenantId: inv.tenantId, invoiceId,
        }).catch(() => undefined);
      }
    }
    for (const tenantId of graceTenantIds) {
      await this.reminders.notifyTransition({ kind: 'ON_GRACE', tenantId }).catch(() => undefined);
    }
    for (const tenantId of suspendTenantIds) {
      await this.reminders.notifyTransition({ kind: 'ON_SUSPEND', tenantId }).catch(() => undefined);
    }

    return {
      markedOverdue,
      grace: toGrace.length,
      suspended: toSuspend.length,
      graceCodes: toGrace,
      suspendedCodes: toSuspend,
      graceDays: profile.graceDays,
    };
  }

  async runBillingReminders(input: { workspaceId?: string } = {}) {
    return this.reminders.run(input);
  }

  async billingInvoiceDocument(id?: string) {
    if (!id) throw new BadRequestException('ID invoice wajib.');
    const inv = await this.prisma.platformInvoice.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!inv) throw new BadRequestException('Invoice tidak ditemukan.');
    const profile = await this.ensureBillingProfile();
    const amount = Number(inv.amount);
    const statusLabel: Record<string, string> = {
      UNPAID: 'Belum bayar', PAID: 'Lunas', OVERDUE: 'Jatuh tempo',
      DRAFT: 'Draft', ISSUED: 'Belum bayar', VOID: 'Void',
    };
    let status = String(normalizeInvoiceStatus(inv.status, inv.dueAt));

    const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="52" height="52" aria-hidden="true">
      <rect x="18" y="18" width="84" height="12" rx="6" fill="#0A2E63"/>
      <rect x="28" y="38" width="28" height="11" rx="5.5" fill="#0A2E63"/>
      <rect x="64" y="38" width="28" height="11" rx="5.5" fill="#0A2E63"/>
      <rect x="40" y="57" width="40" height="11" rx="5.5" fill="#0A2E63"/>
      <rect x="48" y="76" width="24" height="11" rx="5.5" fill="#1E9E43"/>
      <rect x="54" y="95" width="12" height="10" rx="5" fill="#1E9E43"/>
    </svg>`;

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/>
<title>${this.esc(inv.number)}</title>
<style>
  @page{margin:16mm}
  body{font-family:Manrope,system-ui,sans-serif;color:#1A1F2C;margin:0;padding:28px;background:#fff}
  .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #0A2E63;padding-bottom:16px;margin-bottom:20px}
  .brand{display:flex;gap:12px;align-items:center}
  .brand b{display:block;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:22px;letter-spacing:.04em;color:#0A2E63}
  .brand b span{color:#1E9E43}
  .brand small{display:block;color:#64748B;font-size:11px;margin-top:2px}
  .meta{text-align:right;font-size:12.5px;color:#334155;line-height:1.55}
  .meta strong{display:block;font-size:18px;color:#0A2E63;margin-bottom:4px}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;background:#ECFDF5;color:#15803D}
  .badge.due{background:#FEF2F2;color:#DC2626}
  .badge.paid{background:#DCFCE7;color:#166534}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
  .box{border:1px solid #E5E7EB;border-radius:12px;padding:14px;background:#F8FAFC}
  .box h3{margin:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#64748B}
  .box p{margin:0;font-size:13px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:left}
  th{background:#0A2E63;color:#fff;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
  .tot td{font-weight:800;background:#F0FDF4;border-bottom:0}
  .pay{margin-top:18px;padding:14px;border-radius:12px;border:1px dashed #86EFAC;background:#F0FDF4;font-size:13px;line-height:1.55}
  .foot{margin-top:28px;font-size:11.5px;color:#94A3B8;display:flex;justify-content:space-between;gap:12px}
</style></head><body>
  <div class="head">
    <div class="brand">${logoSvg}<div>
      <b>TUM<span>BU</span></b>
      <small>${this.esc(profile.tagline)}</small>
      <small style="margin-top:8px;display:block;color:#334155">${this.esc(profile.legalName)}<br/>${this.esc(profile.address)}<br/>${this.esc(profile.phone)} · ${this.esc(profile.email)}${profile.npwp ? `<br/>NPWP ${this.esc(profile.npwp)}` : ''}</small>
    </div></div>
    <div class="meta">
      <strong>INVOICE</strong>
      ${this.esc(inv.number)}<br/>
      Periode ${this.esc(inv.periodYm)}<br/>
      Terbit ${inv.issuedAt.toLocaleDateString('id-ID')}<br/>
      Jatuh tempo ${inv.dueAt ? inv.dueAt.toLocaleDateString('id-ID') : '—'}<br/>
      <span class="badge ${status === 'PAID' ? 'paid' : status === 'OVERDUE' ? 'due' : ''}">${this.esc(statusLabel[status] || status)}</span>
    </div>
  </div>
  <div class="grid">
    <div class="box"><h3>Ditagihkan kepada</h3>
      <p><b>${this.esc(inv.tenant.name)}</b><br/>Kode: ${this.esc(inv.tenant.code)}<br/>${this.esc(inv.tenant.phone || '—')}<br/>${this.esc(inv.tenant.address || '—')}</p>
    </div>
    <div class="box"><h3>Keterangan</h3>
      <p>${this.esc(inv.description || inv.planName)}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Periode</th><th style="text-align:right">Jumlah</th></tr></thead>
    <tbody>
      <tr><td>${this.esc(inv.planName)}</td><td>${this.esc(inv.periodYm)}</td><td style="text-align:right">${this.money(amount)}</td></tr>
      <tr class="tot"><td colspan="2">Total tagihan</td><td style="text-align:right">${this.money(amount)}</td></tr>
    </tbody>
  </table>
  <div class="pay">
    <b>Transfer ke rekening TUMBU</b><br/>
    ${this.esc(profile.bankName)} · ${this.esc(profile.bankAccount)} a.n. ${this.esc(profile.bankHolder)}<br/>
    Cantumkan nomor invoice pada berita transfer. Setelah bayar, admin akan menandai lunas.
  </div>
  <div class="foot">
    <span>Dokumen otomatis dari TUMBU Platform — dapat diedit profil penerbit di menu Tagihan.</span>
    <span>Halaman 1/1</span>
  </div>
</body></html>`;

    return { title: `Invoice ${inv.number}`, html, fileName: `${inv.number}.pdf` };
  }
}
