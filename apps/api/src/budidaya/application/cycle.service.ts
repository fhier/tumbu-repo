/**
 * CultureCycle application service — 8.3
 * Create / read / update plan / MARK_READY / CANCEL.
 * Tidak menjalankan Feed/Harvest/Close events (itu 8.4+).
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import { PlanQuotaService } from '../../platform/plan-quota.service';
import { CycleTransitionService } from '../workflow/cycle-transition.service';
import {
  canUpdateCyclePlan,
} from '../workflow/cycle-transition';
import type { CycleState } from '../domain/enums';

function str(v: unknown, fallback = ''): string {
  return String(v ?? fallback).trim();
}

function optStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function optDec(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException('Nilai numerik tidak valid.');
  return n;
}

function optInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) throw new BadRequestException('Nilai bilangan tidak valid.');
  return n;
}

@Injectable()
export class BudidayaCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly transitions: CycleTransitionService,
    private readonly planQuota: PlanQuotaService,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  list(filters: { state?: string; pondId?: string } = {}) {
    const state = optStr(filters.state) || undefined;
    const pondId = optStr(filters.pondId) || undefined;
    return this.prisma.aquaCultureCycle.findMany({
      where: {
        tenantId: this.tid(),
        ...(state ? { state } : {}),
        ...(pondId ? { pondId } : {}),
      },
      include: {
        pond: { select: { id: true, code: true, name: true, status: true } },
        speciesProfile: { select: { id: true, code: true, name: true, isActive: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const row = await this.prisma.aquaCultureCycle.findFirst({
      where: { id, tenantId: this.tid() },
      include: {
        pond: true,
        speciesProfile: true,
      },
    });
    if (!row) throw new NotFoundException('Siklus tidak ditemukan.');
    return row;
  }

  async create(input: Record<string, unknown> = {}) {
    await this.planQuota.assertCanCreateCycle();
    const pondId = str(input.pondId);
    const speciesProfileId = str(input.speciesProfileId);
    if (!pondId || !speciesProfileId) {
      throw new BadRequestException('pondId dan speciesProfileId wajib.');
    }

    const pond = await this.prisma.aquaPond.findFirst({
      where: { id: pondId, tenantId: this.tid() },
    });
    if (!pond) throw new BadRequestException('Kolam tidak ditemukan di workspace ini.');
    if (pond.status === 'RETIRED') {
      throw new BadRequestException('Kolam sudah dinonaktifkan (RETIRED).');
    }

    const species = await this.prisma.aquaSpeciesProfile.findFirst({
      where: { id: speciesProfileId, tenantId: this.tid() },
    });
    if (!species) throw new BadRequestException('Jenis ikan tidak ditemukan di workspace ini.');
    if (!species.isActive) {
      throw new BadRequestException('Jenis ikan nonaktif.');
    }

    await this.assertPondAvailable(pondId);

    let code = str(input.code);
    if (!code) {
      code = await this.nextCode();
    }

    const data = {
      tenantId: this.tid(),
      pondId,
      speciesProfileId,
      code,
      state: 'PLANNED' as CycleState,
      seedSupplierPartnerId: optStr(input.seedSupplierPartnerId) ?? undefined,
      initialCapital: optDec(input.initialCapital) ?? undefined,
      notes: optStr(input.notes) ?? undefined,
      targetSrPct: optDec(input.targetSrPct) ?? undefined,
      targetFcr: optDec(input.targetFcr) ?? undefined,
      targetWeightGram: optDec(input.targetWeightGram) ?? undefined,
      targetDays: optInt(input.targetDays) ?? undefined,
      targetBopAmount: optDec(input.targetBopAmount) ?? undefined,
      targetHarvestKg: optDec(input.targetHarvestKg) ?? undefined,
      targetRevenue: optDec(input.targetRevenue) ?? undefined,
      categoryTargetsJson:
        input.categoryTargetsJson !== undefined
          ? typeof input.categoryTargetsJson === 'string'
            ? String(input.categoryTargetsJson)
            : JSON.stringify(input.categoryTargetsJson ?? {})
          : '{}',
    };

    try {
      return await this.prisma.aquaCultureCycle.create({
        data,
        include: {
          pond: { select: { id: true, code: true, name: true } },
          speciesProfile: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode siklus sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updatePlan(id: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(id);
    if (!canUpdateCyclePlan(cycle.state as CycleState)) {
      throw new BadRequestException(
        `Target/rencana hanya dapat diubah pada state PLANNED atau READY (sekarang: ${cycle.state}).`,
      );
    }

    const data: Record<string, unknown> = {};
    if (input.notes !== undefined) data.notes = optStr(input.notes);
    if (input.seedSupplierPartnerId !== undefined) {
      data.seedSupplierPartnerId = optStr(input.seedSupplierPartnerId);
    }
    if (input.initialCapital !== undefined) data.initialCapital = optDec(input.initialCapital);
    if (input.targetSrPct !== undefined) data.targetSrPct = optDec(input.targetSrPct);
    if (input.targetFcr !== undefined) data.targetFcr = optDec(input.targetFcr);
    if (input.targetWeightGram !== undefined) data.targetWeightGram = optDec(input.targetWeightGram);
    if (input.targetDays !== undefined) data.targetDays = optInt(input.targetDays);
    if (input.targetBopAmount !== undefined) data.targetBopAmount = optDec(input.targetBopAmount);
    if (input.targetHarvestKg !== undefined) data.targetHarvestKg = optDec(input.targetHarvestKg);
    if (input.targetRevenue !== undefined) data.targetRevenue = optDec(input.targetRevenue);
    if (input.categoryTargetsJson !== undefined) {
      data.categoryTargetsJson =
        typeof input.categoryTargetsJson === 'string'
          ? String(input.categoryTargetsJson)
          : JSON.stringify(input.categoryTargetsJson ?? {});
    }

    // Referensi pond/species hanya boleh diganti saat PLANNED
    if (input.pondId !== undefined || input.speciesProfileId !== undefined) {
      if (cycle.state !== 'PLANNED') {
        throw new BadRequestException('Kolam/jenis ikan hanya dapat diganti saat PLANNED.');
      }
      if (input.pondId !== undefined) {
        const pondId = str(input.pondId);
        const pond = await this.prisma.aquaPond.findFirst({
          where: { id: pondId, tenantId: this.tid() },
        });
        if (!pond || pond.status === 'RETIRED') {
          throw new BadRequestException('Kolam tidak valid.');
        }
        await this.assertPondAvailable(pondId, cycle.id);
        data.pondId = pondId;
      }
      if (input.speciesProfileId !== undefined) {
        const speciesProfileId = str(input.speciesProfileId);
        const species = await this.prisma.aquaSpeciesProfile.findFirst({
          where: { id: speciesProfileId, tenantId: this.tid() },
        });
        if (!species || !species.isActive) {
          throw new BadRequestException('Jenis ikan tidak valid.');
        }
        data.speciesProfileId = speciesProfileId;
      }
    }

    return this.prisma.aquaCultureCycle.update({
      where: { id },
      data,
      include: {
        pond: { select: { id: true, code: true, name: true } },
        speciesProfile: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async markReady(id: string) {
    const cycle = await this.requireCycle(id);
    await this.assertPondAvailable(cycle.pondId, cycle.id);
    return this.transitions.transition({
      cycleId: id,
      tenantId: this.tid(),
      to: 'READY',
      trigger: 'MARK_READY',
    });
  }

  async cancel(id: string) {
    await this.requireCycle(id);
    return this.transitions.transition({
      cycleId: id,
      tenantId: this.tid(),
      to: 'CANCELLED',
      trigger: 'CANCEL',
      extra: { closedAt: new Date() },
    });
  }

  private async requireCycle(id: string) {
    const row = await this.prisma.aquaCultureCycle.findFirst({
      where: { id, tenantId: this.tid() },
    });
    if (!row) throw new NotFoundException('Siklus tidak ditemukan.');
    return row;
  }

  /** Max one READY/ACTIVE/HARVESTING cycle per pond */
  private async assertPondAvailable(pondId: string, exceptCycleId?: string) {
    const occupying = await this.prisma.aquaCultureCycle.findFirst({
      where: {
        tenantId: this.tid(),
        pondId,
        state: { in: ['READY', 'ACTIVE', 'HARVESTING'] },
        ...(exceptCycleId ? { NOT: { id: exceptCycleId } } : {}),
      },
    });
    if (occupying) {
      throw new BadRequestException(
        `Kolam masih dipakai siklus ${occupying.code} (${occupying.state}).`,
      );
    }
  }

  private async nextCode(): Promise<string> {
    const day = new Date();
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const prefix = `SK-${y}${m}${d}-`;
    const latest = await this.prisma.aquaCultureCycle.findFirst({
      where: { tenantId: this.tid(), code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    let seq = 1;
    if (latest?.code) {
      const part = latest.code.slice(prefix.length);
      const n = parseInt(part, 10);
      if (Number.isFinite(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
