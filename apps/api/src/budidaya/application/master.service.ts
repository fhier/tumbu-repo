// @ts-nocheck
/**
 * Master Data Budidaya — 8.2
 *
 * ATURAN (Owner): Master Data tidak boleh memiliki side effect.
 * - create/update/deactivate FeedType ≠ event / formula / cycle
 * - create SpeciesProfile ≠ CultureCycle
 * - create CostCategory ≠ hitung BOP
 *
 * Partner (Supplier/Pelanggan) = reuse platform `/erp/partners` — tidak digandakan.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import { PlanQuotaService } from '../../platform/plan-quota.service';
import { COST_CLASSES, COST_NATURES, METRIC_DIRECTIONS, POND_STATUSES } from '../domain/enums';
import {
  INDONESIAN_FRESHWATER_SPECIES,
  POND_SYSTEM_TYPES,
  VESSEL_TYPE_GROUPS,
  computePondMetrics,
  resolvePondSystemType,
} from '../domain/aqua-knowledge';

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
export class BudidayaMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly planQuota: PlanQuotaService,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  // —— Pond ——
  listPonds(includeRetired = false) {
    return this.prisma.aquaPond.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeRetired ? {} : { NOT: { status: 'RETIRED' } }),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  catalogPondSystems() {
    return POND_SYSTEM_TYPES;
  }

  catalogVesselGroups() {
    return VESSEL_TYPE_GROUPS;
  }

  catalogSpecies() {
    return INDONESIAN_FRESHWATER_SPECIES;
  }

  private pondMetricsFromInput(input: Record<string, unknown>) {
    const lengthM = optDec(input.lengthM);
    const widthM = optDec(input.widthM);
    const depthM = optDec(input.depthM);
    const computed = computePondMetrics(lengthM, widthM, depthM);
    let areaM2 = computed.areaM2 ?? optDec(input.areaM2) ?? undefined;
    let volumeM3 = computed.volumeM3 ?? optDec(input.volumeM3) ?? undefined;

    // Urban farming: volume liter → m³
    const volumeLiter = optDec(input.volumeLiter);
    if (volumeLiter != null && volumeLiter > 0) {
      volumeM3 = Math.round((volumeLiter / 1000) * 1000) / 1000;
    }
    // Diameter (m) → luas lingkaran & volume bundar/bioflok
    const diameterM = optDec(input.diameterM);
    if (diameterM != null && diameterM > 0) {
      const r = diameterM / 2;
      if (areaM2 == null) {
        areaM2 = Math.round(Math.PI * r * r * 1000) / 1000;
      }
      if (volumeM3 == null && depthM != null && depthM > 0) {
        volumeM3 = Math.round(0.25 * Math.PI * diameterM * diameterM * depthM * 1000) / 1000;
      }
    }
    return { areaM2, volumeM3 };
  }

  private async nextVesselCode(): Promise<string> {
    const existing = await this.prisma.aquaPond.findMany({
      where: { tenantId: this.tid() },
      select: { code: true },
    });
    const used = new Set(existing.map((p) => p.code.toUpperCase()));
    let n = existing.length + 1;
    for (let i = 0; i < 9999; i += 1) {
      const code = `WDH-${String(n).padStart(3, '0')}`;
      if (!used.has(code)) return code;
      n += 1;
    }
    return `WDH-${Date.now().toString(36).toUpperCase()}`;
  }

  async createPond(input: Record<string, unknown> = {}) {
    await this.planQuota.assertCanCreatePond();
    let code = str(input.code);
    const name = str(input.name);
    if (!name) throw new BadRequestException('Nama wadah budidaya wajib diisi.');
    if (!code) code = await this.nextVesselCode();
    const status = str(input.status, 'IDLE') || 'IDLE';
    if (!(POND_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Status wadah tidak valid.');
    }
    const dims = this.pondMetricsFromInput(input);
    const systemType = resolvePondSystemType(optStr(input.systemType) ?? undefined);
    const diameterM = optDec(input.diameterM);
    const volumeLiter = optDec(input.volumeLiter);
    const noteBits = [
      optStr(input.notes) || '',
      diameterM != null && diameterM > 0 ? `Diameter ${diameterM} m` : '',
      volumeLiter != null && volumeLiter > 0 ? `Volume ${volumeLiter} L` : '',
    ].filter(Boolean);
    try {
      return await this.prisma.aquaPond.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          areaM2: dims.areaM2,
          volumeM3: dims.volumeM3,
          location: optStr(input.location) ?? undefined,
          systemType: systemType ?? undefined,
          status,
          notes: noteBits.length ? noteBits.join(' · ') : undefined,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode kolam sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updatePond(id: string, input: Record<string, unknown> = {}) {
    await this.requirePond(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code);
      if (!code) throw new BadRequestException('Kode kolam wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama kolam wajib.');
      data.name = name;
    }
    if (
      input.lengthM !== undefined ||
      input.widthM !== undefined ||
      input.depthM !== undefined ||
      input.diameterM !== undefined ||
      input.volumeLiter !== undefined ||
      input.areaM2 !== undefined ||
      input.volumeM3 !== undefined
    ) {
      const dims = this.pondMetricsFromInput(input);
      if (dims.areaM2 !== undefined) data.areaM2 = dims.areaM2;
      if (dims.volumeM3 !== undefined) data.volumeM3 = dims.volumeM3;
    }
    if (input.location !== undefined) data.location = optStr(input.location);
    if (input.systemType !== undefined) {
      data.systemType = resolvePondSystemType(optStr(input.systemType) ?? undefined);
    }
    if (input.status !== undefined) {
      const status = str(input.status);
      if (!(POND_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException('Status kolam tidak valid.');
      }
      data.status = status;
    }
    if (input.notes !== undefined) data.notes = optStr(input.notes);
    try {
      return await this.prisma.aquaPond.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode kolam sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  /** Soft deactivate — status RETIRED (bukan hapus baris; tidak memicu event). */
  async deactivatePond(id: string) {
    await this.requirePond(id);
    return this.prisma.aquaPond.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
  }

  private async requirePond(id: string) {
    const row = await this.prisma.aquaPond.findFirst({ where: { id, tenantId: this.tid() } });
    if (!row) throw new NotFoundException('Kolam tidak ditemukan.');
    return row;
  }

  // —— SpeciesProfile ——
  listSpecies(includeInactive = false) {
    return this.prisma.aquaSpeciesProfile.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async createSpecies(input: Record<string, unknown> = {}) {
    const code = str(input.code).toUpperCase();
    const name = str(input.name);
    if (!code || !name) throw new BadRequestException('Kode dan nama jenis ikan wajib.');
    try {
      return await this.prisma.aquaSpeciesProfile.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          defaultDensity: optDec(input.defaultDensity) ?? undefined,
          densityUnit: optStr(input.densityUnit) ?? undefined,
          typicalDays: optInt(input.typicalDays) ?? undefined,
          typicalFcr: optDec(input.typicalFcr) ?? undefined,
          typicalSrPct: optDec(input.typicalSrPct) ?? undefined,
          targetWeightGram: optDec(input.targetWeightGram) ?? undefined,
          defaultPriceHint: optDec(input.defaultPriceHint) ?? undefined,
          isActive: input.isActive === false ? false : true,
          notes: optStr(input.notes) ?? undefined,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode jenis ikan sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updateSpecies(id: string, input: Record<string, unknown> = {}) {
    await this.requireSpecies(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code).toUpperCase();
      if (!code) throw new BadRequestException('Kode jenis ikan wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama jenis ikan wajib.');
      data.name = name;
    }
    if (input.defaultDensity !== undefined) data.defaultDensity = optDec(input.defaultDensity);
    if (input.densityUnit !== undefined) data.densityUnit = optStr(input.densityUnit);
    if (input.typicalDays !== undefined) data.typicalDays = optInt(input.typicalDays);
    if (input.typicalFcr !== undefined) data.typicalFcr = optDec(input.typicalFcr);
    if (input.typicalSrPct !== undefined) data.typicalSrPct = optDec(input.typicalSrPct);
    if (input.targetWeightGram !== undefined) data.targetWeightGram = optDec(input.targetWeightGram);
    if (input.defaultPriceHint !== undefined) data.defaultPriceHint = optDec(input.defaultPriceHint);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (input.notes !== undefined) data.notes = optStr(input.notes);
    try {
      return await this.prisma.aquaSpeciesProfile.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode jenis ikan sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async deactivateSpecies(id: string) {
    await this.requireSpecies(id);
    return this.prisma.aquaSpeciesProfile.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Seed katalog spesies air tawar Indonesia — idempotent, tidak menimpa yang sudah ada. */
  async ensureDefaultSpecies() {
    const tid = this.tid();
    for (const s of INDONESIAN_FRESHWATER_SPECIES) {
      const existing = await this.prisma.aquaSpeciesProfile.findFirst({
        where: { tenantId: tid, code: s.code },
      });
      if (existing) continue;
      await this.prisma.aquaSpeciesProfile.create({
        data: {
          tenantId: tid,
          code: s.code,
          name: s.name,
          typicalDays: s.typicalDays,
          typicalFcr: s.typicalFcr,
          typicalSrPct: s.typicalSrPct,
          targetWeightGram: s.targetWeightGram,
          defaultDensity: s.defaultDensity,
          densityUnit: s.densityUnit,
          notes: s.notes,
          isActive: true,
        },
      });
    }
    return this.listSpecies(true);
  }

  private async requireSpecies(id: string) {
    const row = await this.prisma.aquaSpeciesProfile.findFirst({
      where: { id, tenantId: this.tid() },
    });
    if (!row) throw new NotFoundException('Jenis ikan tidak ditemukan.');
    return row;
  }

  // —— FeedType ——
  listFeedTypes(includeInactive = false) {
    return this.prisma.aquaFeedType.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createFeedType(input: Record<string, unknown> = {}) {
    const name = str(input.name);
    if (!name) throw new BadRequestException('Nama pakan wajib.');
    return this.prisma.aquaFeedType.create({
      data: {
        tenantId: this.tid(),
        name,
        brand: optStr(input.brand) ?? undefined,
        proteinPct: optDec(input.proteinPct) ?? undefined,
        unit: str(input.unit, 'kg') || 'kg',
        defaultPrice: optDec(input.defaultPrice) ?? undefined,
        isActive: input.isActive === false ? false : true,
      },
    });
  }

  async updateFeedType(id: string, input: Record<string, unknown> = {}) {
    await this.requireFeedType(id);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama pakan wajib.');
      data.name = name;
    }
    if (input.brand !== undefined) data.brand = optStr(input.brand);
    if (input.proteinPct !== undefined) data.proteinPct = optDec(input.proteinPct);
    if (input.unit !== undefined) data.unit = str(input.unit, 'kg') || 'kg';
    if (input.defaultPrice !== undefined) data.defaultPrice = optDec(input.defaultPrice);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    return this.prisma.aquaFeedType.update({ where: { id }, data });
  }

  async deactivateFeedType(id: string) {
    await this.requireFeedType(id);
    return this.prisma.aquaFeedType.update({ where: { id }, data: { isActive: false } });
  }

  private async requireFeedType(id: string) {
    const row = await this.prisma.aquaFeedType.findFirst({ where: { id, tenantId: this.tid() } });
    if (!row) throw new NotFoundException('Jenis pakan tidak ditemukan.');
    return row;
  }

  // —— CostCategory ——
  listCostCategories(includeInactive = false) {
    return this.prisma.aquaCostCategory.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async createCostCategory(input: Record<string, unknown> = {}) {
    const code = str(input.code).toUpperCase();
    const name = str(input.name);
    const costClass = str(input.costClass).toUpperCase();
    if (!code || !name) throw new BadRequestException('Kode dan nama kategori wajib.');
    if (!(COST_CLASSES as readonly string[]).includes(costClass)) {
      throw new BadRequestException('costClass harus DIRECT atau INDIRECT.');
    }
    let costNature = optStr(input.costNature);
    if (costNature) {
      costNature = costNature.toUpperCase();
      if (!(COST_NATURES as readonly string[]).includes(costNature)) {
        throw new BadRequestException('costNature harus VARIABLE atau FIXED.');
      }
    }
    try {
      return await this.prisma.aquaCostCategory.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          costClass,
          costNature: costNature ?? undefined,
          sortOrder: optInt(input.sortOrder) ?? 0,
          isActive: input.isActive === false ? false : true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode kategori sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updateCostCategory(id: string, input: Record<string, unknown> = {}) {
    await this.requireCostCategory(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code).toUpperCase();
      if (!code) throw new BadRequestException('Kode kategori wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama kategori wajib.');
      data.name = name;
    }
    if (input.costClass !== undefined) {
      const costClass = str(input.costClass).toUpperCase();
      if (!(COST_CLASSES as readonly string[]).includes(costClass)) {
        throw new BadRequestException('costClass harus DIRECT atau INDIRECT.');
      }
      data.costClass = costClass;
    }
    if (input.costNature !== undefined) {
      let costNature = optStr(input.costNature);
      if (costNature) {
        costNature = costNature.toUpperCase();
        if (!(COST_NATURES as readonly string[]).includes(costNature)) {
          throw new BadRequestException('costNature harus VARIABLE atau FIXED.');
        }
      }
      data.costNature = costNature;
    }
    if (input.sortOrder !== undefined) data.sortOrder = optInt(input.sortOrder) ?? 0;
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    try {
      return await this.prisma.aquaCostCategory.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode kategori sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async deactivateCostCategory(id: string) {
    await this.requireCostCategory(id);
    return this.prisma.aquaCostCategory.update({ where: { id }, data: { isActive: false } });
  }

  private async requireCostCategory(id: string) {
    const row = await this.prisma.aquaCostCategory.findFirst({
      where: { id, tenantId: this.tid() },
    });
    if (!row) throw new NotFoundException('Kategori biaya tidak ditemukan.');
    return row;
  }

  // —— IndicatorRule ——
  listIndicatorRules(includeInactive = false) {
    return this.prisma.aquaIndicatorRule.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ metricCode: 'asc' }],
    });
  }

  async createIndicatorRule(input: Record<string, unknown> = {}) {
    const metricCode = str(input.metricCode).toUpperCase();
    const direction = str(input.direction).toUpperCase();
    if (!metricCode) throw new BadRequestException('metricCode wajib.');
    if (!(METRIC_DIRECTIONS as readonly string[]).includes(direction)) {
      throw new BadRequestException('direction harus LOWER_BETTER atau HIGHER_BETTER.');
    }
    const greenBound = optDec(input.greenBound);
    const yellowBound = optDec(input.yellowBound);
    if (greenBound == null || yellowBound == null) {
      throw new BadRequestException('greenBound dan yellowBound wajib.');
    }
    const speciesProfileId = optStr(input.speciesProfileId);
    if (speciesProfileId) await this.requireSpecies(speciesProfileId);
    return this.prisma.aquaIndicatorRule.create({
      data: {
        tenantId: this.tid(),
        metricCode,
        direction,
        greenBound,
        yellowBound,
        speciesProfileId: speciesProfileId ?? undefined,
        isActive: input.isActive === false ? false : true,
      },
    });
  }

  async updateIndicatorRule(id: string, input: Record<string, unknown> = {}) {
    await this.requireIndicatorRule(id);
    const data: Record<string, unknown> = {};
    if (input.metricCode !== undefined) {
      const metricCode = str(input.metricCode).toUpperCase();
      if (!metricCode) throw new BadRequestException('metricCode wajib.');
      data.metricCode = metricCode;
    }
    if (input.direction !== undefined) {
      const direction = str(input.direction).toUpperCase();
      if (!(METRIC_DIRECTIONS as readonly string[]).includes(direction)) {
        throw new BadRequestException('direction harus LOWER_BETTER atau HIGHER_BETTER.');
      }
      data.direction = direction;
    }
    if (input.greenBound !== undefined) {
      const greenBound = optDec(input.greenBound);
      if (greenBound == null) throw new BadRequestException('greenBound wajib.');
      data.greenBound = greenBound;
    }
    if (input.yellowBound !== undefined) {
      const yellowBound = optDec(input.yellowBound);
      if (yellowBound == null) throw new BadRequestException('yellowBound wajib.');
      data.yellowBound = yellowBound;
    }
    if (input.speciesProfileId !== undefined) {
      const speciesProfileId = optStr(input.speciesProfileId);
      if (speciesProfileId) await this.requireSpecies(speciesProfileId);
      data.speciesProfileId = speciesProfileId;
    }
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    return this.prisma.aquaIndicatorRule.update({ where: { id }, data });
  }

  async deactivateIndicatorRule(id: string) {
    await this.requireIndicatorRule(id);
    return this.prisma.aquaIndicatorRule.update({ where: { id }, data: { isActive: false } });
  }

  private async requireIndicatorRule(id: string) {
    const row = await this.prisma.aquaIndicatorRule.findFirst({
      where: { id, tenantId: this.tid() },
    });
    if (!row) throw new NotFoundException('Indicator rule tidak ditemukan.');
    return row;
  }

  // —— Strain (katalog; tidak membuat siklus / event) ——
  listStrains(includeInactive = false, speciesProfileId?: string) {
    return this.prisma.aquaStrain.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
        ...(speciesProfileId ? { speciesProfileId } : {}),
      },
      orderBy: [{ code: 'asc' }],
      include: { speciesProfile: { select: { id: true, code: true, name: true } } },
    });
  }

  async createStrain(input: Record<string, unknown> = {}) {
    const code = str(input.code).toUpperCase();
    const name = str(input.name);
    if (!code || !name) throw new BadRequestException('Kode dan nama strain wajib.');
    const speciesProfileId = optStr(input.speciesProfileId);
    if (speciesProfileId) await this.requireSpecies(speciesProfileId);
    try {
      return await this.prisma.aquaStrain.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          speciesProfileId: speciesProfileId ?? undefined,
          notes: optStr(input.notes) ?? undefined,
          isActive: input.isActive === false ? false : true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode strain sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updateStrain(id: string, input: Record<string, unknown> = {}) {
    await this.requireStrain(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code).toUpperCase();
      if (!code) throw new BadRequestException('Kode strain wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama strain wajib.');
      data.name = name;
    }
    if (input.speciesProfileId !== undefined) {
      const speciesProfileId = optStr(input.speciesProfileId);
      if (speciesProfileId) await this.requireSpecies(speciesProfileId);
      data.speciesProfileId = speciesProfileId;
    }
    if (input.notes !== undefined) data.notes = optStr(input.notes);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    try {
      return await this.prisma.aquaStrain.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode strain sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async deactivateStrain(id: string) {
    await this.requireStrain(id);
    return this.prisma.aquaStrain.update({ where: { id }, data: { isActive: false } });
  }

  private async requireStrain(id: string) {
    const row = await this.prisma.aquaStrain.findFirst({ where: { id, tenantId: this.tid() } });
    if (!row) throw new NotFoundException('Strain tidak ditemukan.');
    return row;
  }

  // —— Unit (satuan) ——
  listUnits(includeInactive = false) {
    return this.prisma.aquaUnit.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async createUnit(input: Record<string, unknown> = {}) {
    const code = str(input.code).toLowerCase();
    const name = str(input.name);
    if (!code || !name) throw new BadRequestException('Kode dan nama satuan wajib.');
    try {
      return await this.prisma.aquaUnit.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          symbol: optStr(input.symbol) ?? undefined,
          sortOrder: optInt(input.sortOrder) ?? 0,
          isActive: input.isActive === false ? false : true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode satuan sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updateUnit(id: string, input: Record<string, unknown> = {}) {
    await this.requireUnit(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code).toLowerCase();
      if (!code) throw new BadRequestException('Kode satuan wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama satuan wajib.');
      data.name = name;
    }
    if (input.symbol !== undefined) data.symbol = optStr(input.symbol);
    if (input.sortOrder !== undefined) data.sortOrder = optInt(input.sortOrder) ?? 0;
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    try {
      return await this.prisma.aquaUnit.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode satuan sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async deactivateUnit(id: string) {
    await this.requireUnit(id);
    return this.prisma.aquaUnit.update({ where: { id }, data: { isActive: false } });
  }

  /** Seed satuan dasar bila kosong — idempotent, tanpa side effect operasional. */
  async ensureDefaultUnits() {
    const count = await this.prisma.aquaUnit.count({ where: { tenantId: this.tid() } });
    if (count > 0) return this.listUnits(true);
    const defaults = [
      { code: 'kg', name: 'Kilogram', symbol: 'kg', sortOrder: 1 },
      { code: 'g', name: 'Gram', symbol: 'g', sortOrder: 2 },
      { code: 'ekor', name: 'Ekor', symbol: 'ekor', sortOrder: 3 },
      { code: 'liter', name: 'Liter', symbol: 'L', sortOrder: 4 },
    ];
    for (const d of defaults) {
      await this.prisma.aquaUnit.create({
        data: { tenantId: this.tid(), ...d, isActive: true },
      });
    }
    return this.listUnits(true);
  }

  private async requireUnit(id: string) {
    const row = await this.prisma.aquaUnit.findFirst({ where: { id, tenantId: this.tid() } });
    if (!row) throw new NotFoundException('Satuan tidak ditemukan.');
    return row;
  }

  // —— Mortality cause ——
  listMortalityCauses(includeInactive = false) {
    return this.prisma.aquaMortalityCause.findMany({
      where: {
        tenantId: this.tid(),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async createMortalityCause(input: Record<string, unknown> = {}) {
    const code = str(input.code).toUpperCase();
    const name = str(input.name);
    if (!code || !name) throw new BadRequestException('Kode dan nama penyebab wajib.');
    try {
      return await this.prisma.aquaMortalityCause.create({
        data: {
          tenantId: this.tid(),
          code,
          name,
          sortOrder: optInt(input.sortOrder) ?? 0,
          notes: optStr(input.notes) ?? undefined,
          isActive: input.isActive === false ? false : true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode penyebab sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async updateMortalityCause(id: string, input: Record<string, unknown> = {}) {
    await this.requireMortalityCause(id);
    const data: Record<string, unknown> = {};
    if (input.code !== undefined) {
      const code = str(input.code).toUpperCase();
      if (!code) throw new BadRequestException('Kode penyebab wajib.');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = str(input.name);
      if (!name) throw new BadRequestException('Nama penyebab wajib.');
      data.name = name;
    }
    if (input.sortOrder !== undefined) data.sortOrder = optInt(input.sortOrder) ?? 0;
    if (input.notes !== undefined) data.notes = optStr(input.notes);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    try {
      return await this.prisma.aquaMortalityCause.update({ where: { id }, data });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Kode penyebab sudah dipakai di workspace ini.');
      }
      throw e;
    }
  }

  async deactivateMortalityCause(id: string) {
    await this.requireMortalityCause(id);
    return this.prisma.aquaMortalityCause.update({ where: { id }, data: { isActive: false } });
  }

  async ensureDefaultMortalityCauses() {
    const count = await this.prisma.aquaMortalityCause.count({ where: { tenantId: this.tid() } });
    if (count > 0) return this.listMortalityCauses(true);
    const defaults = [
      { code: 'UNKNOWN', name: 'Tidak diketahui', sortOrder: 1 },
      { code: 'DISEASE', name: 'Penyakit', sortOrder: 2 },
      { code: 'OXYGEN', name: 'Kekurangan oksigen', sortOrder: 3 },
      { code: 'HANDLING', name: 'Penanganan', sortOrder: 4 },
      { code: 'PREDATION', name: 'Pemangsa', sortOrder: 5 },
    ];
    for (const d of defaults) {
      await this.prisma.aquaMortalityCause.create({
        data: { tenantId: this.tid(), ...d, isActive: true },
      });
    }
    return this.listMortalityCauses(true);
  }

  private async requireMortalityCause(id: string) {
    const row = await this.prisma.aquaMortalityCause.findFirst({
      where: { id, tenantId: this.tid() },
    });
    if (!row) throw new NotFoundException('Penyebab kematian tidak ditemukan.');
    return row;
  }
}

