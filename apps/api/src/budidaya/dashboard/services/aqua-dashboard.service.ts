/**
 * Aqua Dashboard — komposisi widget; consumer CycleFormulaService.
 *
 * Event → Formula → Dashboard
 * Tidak ada rumus, tidak ada write DB, tidak ada tabel ringkasan.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContext } from '../../../erp/tenant.context';
import { CycleFormulaService } from '../../formula/services/cycle-formula.service';
import { isOccupyingPondState } from '../../workflow/cycle-transition';
import type { CycleListRow, FormulaSnapshot } from '../types';
import {
  buildAlertSummary,
  buildCycleSummary,
  buildFinancialSummary,
  buildProductionSummary,
} from '../widgets';

@Injectable()
export class AquaDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly formula: CycleFormulaService,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  async compose() {
    const tid = this.tid();

    const [ponds, cycleRows] = await Promise.all([
      this.prisma.aquaPond.findMany({
        where: { tenantId: tid, status: { not: 'RETIRED' } },
        select: { id: true, status: true },
      }),
      this.prisma.aquaCultureCycle.findMany({
        where: { tenantId: tid },
        include: {
          pond: { select: { id: true, code: true, name: true } },
          speciesProfile: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const running = cycleRows.filter((c) => isOccupyingPondState(c.state as never));
    const cycles: CycleListRow[] = running.map((c) => ({
      id: c.id,
      code: c.code,
      state: c.state,
      pondId: c.pondId,
      pondName: c.pond.name,
      pondCode: c.pond.code,
      speciesName: c.speciesProfile.name,
    }));

    const pondsInUse = new Set([
      ...ponds.filter((p) => p.status === 'IN_USE').map((p) => p.id),
      ...cycles.map((c) => c.pondId),
    ]);

    const formulas: FormulaSnapshot[] = [];
    for (const c of cycles) {
      const snap = await this.formula.forCycle(c.id);
      formulas.push(snap as FormulaSnapshot);
    }

    return {
      /** Komposisi widget — pola multi-blueprint */
      widgets: {
        cycleSummary: buildCycleSummary({
          pondsActive: pondsInUse.size,
          cycles,
        }),
        financialSummary: buildFinancialSummary({ cycles, formulas }),
        productionSummary: buildProductionSummary({ cycles, formulas }),
        alertSummary: buildAlertSummary({ cycles, formulas }),
      },
      computedAt: new Date().toISOString(),
    };
  }
}
