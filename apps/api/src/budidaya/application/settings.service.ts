// @ts-nocheck
/**
 * Workspace settings khusus Budidaya — baca/tulis namespace `budidaya` di settingsJson.
 * Tidak mengubah Formula Engine · tidak menulis Event · tidak snapshot KPI.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';

export type BudidayaFormulaTargets = {
  defaultFcr: number | null;
  defaultSrPct: number | null;
  defaultDays: number | null;
  defaultWeightGram: number | null;
  defaultBopAmount: number | null;
  defaultHarvestKg: number | null;
};

export type BudidayaWorkspaceSettings = {
  formulaTargets: BudidayaFormulaTargets;
  /** Catatan identitas opsional blueprint (bukan KPI) */
  notes: string | null;
};

function emptyTargets(): BudidayaFormulaTargets {
  return {
    defaultFcr: null,
    defaultSrPct: null,
    defaultDays: null,
    defaultWeightGram: null,
    defaultBopAmount: null,
    defaultHarvestKg: null,
  };
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException('Nilai numerik tidak valid.');
  return n;
}

@Injectable()
export class BudidayaSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  async get(): Promise<BudidayaWorkspaceSettings> {
    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    return this.parse(t.settingsJson);
  }

  async update(input: Record<string, unknown> = {}): Promise<BudidayaWorkspaceSettings> {
    const current = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(current.settingsJson || '{}') as Record<string, unknown>;
    } catch {
      raw = {};
    }
    const prev = this.parse(current.settingsJson);
    const ftIn = (input.formulaTargets || {}) as Record<string, unknown>;
    const nextFt: BudidayaFormulaTargets = {
      defaultFcr:
        ftIn.defaultFcr !== undefined ? numOrNull(ftIn.defaultFcr) : prev.formulaTargets.defaultFcr,
      defaultSrPct:
        ftIn.defaultSrPct !== undefined
          ? numOrNull(ftIn.defaultSrPct)
          : prev.formulaTargets.defaultSrPct,
      defaultDays:
        ftIn.defaultDays !== undefined
          ? numOrNull(ftIn.defaultDays)
          : prev.formulaTargets.defaultDays,
      defaultWeightGram:
        ftIn.defaultWeightGram !== undefined
          ? numOrNull(ftIn.defaultWeightGram)
          : prev.formulaTargets.defaultWeightGram,
      defaultBopAmount:
        ftIn.defaultBopAmount !== undefined
          ? numOrNull(ftIn.defaultBopAmount)
          : prev.formulaTargets.defaultBopAmount,
      defaultHarvestKg:
        ftIn.defaultHarvestKg !== undefined
          ? numOrNull(ftIn.defaultHarvestKg)
          : prev.formulaTargets.defaultHarvestKg,
    };
    if (nextFt.defaultSrPct != null && (nextFt.defaultSrPct < 0 || nextFt.defaultSrPct > 100)) {
      throw new BadRequestException('defaultSrPct harus 0–100.');
    }
    if (nextFt.defaultFcr != null && nextFt.defaultFcr < 0) {
      throw new BadRequestException('defaultFcr tidak boleh negatif.');
    }

    const notes =
      input.notes !== undefined
        ? String(input.notes || '').trim() || null
        : prev.notes;

    const budidaya = {
      ...(typeof raw.budidaya === 'object' && raw.budidaya ? (raw.budidaya as object) : {}),
      formulaTargets: nextFt,
      notes,
    };

    await this.prisma.workspace.update({
      where: { id: this.tid() },
      data: { settingsJson: JSON.stringify({ ...raw, budidaya }) },
    });

    return { formulaTargets: nextFt, notes };
  }

  private parse(settingsJson: string | null | undefined): BudidayaWorkspaceSettings {
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(settingsJson || '{}') as Record<string, unknown>;
    } catch {
      raw = {};
    }
    const b = (raw.budidaya || {}) as Record<string, unknown>;
    const ft = (b.formulaTargets || {}) as Record<string, unknown>;
    const base = emptyTargets();
    return {
      formulaTargets: {
        defaultFcr: ft.defaultFcr != null ? Number(ft.defaultFcr) : base.defaultFcr,
        defaultSrPct: ft.defaultSrPct != null ? Number(ft.defaultSrPct) : base.defaultSrPct,
        defaultDays: ft.defaultDays != null ? Number(ft.defaultDays) : base.defaultDays,
        defaultWeightGram:
          ft.defaultWeightGram != null ? Number(ft.defaultWeightGram) : base.defaultWeightGram,
        defaultBopAmount:
          ft.defaultBopAmount != null ? Number(ft.defaultBopAmount) : base.defaultBopAmount,
        defaultHarvestKg:
          ft.defaultHarvestKg != null ? Number(ft.defaultHarvestKg) : base.defaultHarvestKg,
      },
      notes: b.notes != null ? String(b.notes) : null,
    };
  }
}

