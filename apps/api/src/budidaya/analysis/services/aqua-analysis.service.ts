// @ts-nocheck
/**
 * Aqua Analysis — View eksploratif ("mengapa?"), bukan Dashboard kedua.
 *
 * Event → Formula → Analysis View → UI
 * Tidak ada AnalysisEngine / kalkulator / write Event|Cycle / entity SoT.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContext } from '../../../erp/tenant.context';
import { CycleFormulaService } from '../../formula/services/cycle-formula.service';
import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';
import {
  buildCostAnalysis,
  buildDeviationAnalysis,
  buildProductionAnalysis,
  buildProfitAnalysis,
} from '../views';

/** Analisa mencakup siklus yang punya histori (bukan hanya yang berjalan). */
const ANALYSIS_STATES = new Set([
  'READY',
  'ACTIVE',
  'HARVESTING',
  'CLOSED',
]);

@Injectable()
export class AquaAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly formula: CycleFormulaService,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  /** Hub analisa workspace — komposisi View */
  async compose(cycleId?: string) {
    if (cycleId) {
      return this.forCycle(cycleId);
    }

    const cycleRows = await this.prisma.aquaCultureCycle.findMany({
      where: { tenantId: this.tid() },
      include: {
        pond: { select: { id: true, code: true, name: true } },
        speciesProfile: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const selected = cycleRows.filter((c) => ANALYSIS_STATES.has(c.state));
    const cycles = this.toRows(selected);
    const formulas = await this.loadFormulas(cycles);

    return {
      purpose: 'Mengapa hasilnya seperti ini?',
      scope: 'workspace',
      views: this.composeViews(cycles, formulas),
      computedAt: new Date().toISOString(),
    };
  }

  async forCycle(cycleId: string) {
    const row = await this.prisma.aquaCultureCycle.findFirst({
      where: { id: cycleId, tenantId: this.tid() },
      include: {
        pond: { select: { id: true, code: true, name: true } },
        speciesProfile: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException('Siklus tidak ditemukan.');

    const cycles = this.toRows([row]);
    const formulas = await this.loadFormulas(cycles);

    return {
      purpose: 'Mengapa hasilnya seperti ini?',
      scope: 'cycle',
      cycleId,
      views: this.composeViews(cycles, formulas),
      computedAt: new Date().toISOString(),
    };
  }

  private composeViews(cycles: CycleListRow[], formulas: FormulaSnapshot[]) {
    return {
      costAnalysis: buildCostAnalysis({ cycles, formulas }),
      productionAnalysis: buildProductionAnalysis({ cycles, formulas }),
      deviationAnalysis: buildDeviationAnalysis({ cycles, formulas }),
      profitAnalysis: buildProfitAnalysis({ cycles, formulas }),
    };
  }

  private toRows(
    rows: Array<{
      id: string;
      code: string;
      state: string;
      pondId: string;
      pond: { code: string; name: string };
      speciesProfile: { name: string };
    }>,
  ): CycleListRow[] {
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      state: c.state,
      pondId: c.pondId,
      pondName: c.pond.name,
      pondCode: c.pond.code,
      speciesName: c.speciesProfile.name,
    }));
  }

  private async loadFormulas(cycles: CycleListRow[]): Promise<FormulaSnapshot[]> {
    const formulas: FormulaSnapshot[] = [];
    for (const c of cycles) {
      const snap = await this.formula.forCycle(c.id);
      formulas.push(snap as FormulaSnapshot);
    }
    return formulas;
  }
}

