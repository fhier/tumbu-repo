/**
 * CycleFormulaService — baca Event RECORDED → Formula (derived).
 * Tidak menulis KPI ke DB. Tidak dipanggil dari Event create path.
 *
 * Kebijakan BOP V1:
 * - Kanonik (permanen): Σ ExpenseEvent RECORDED (+ Direct/Indirect dari CostCategory)
 * - Interim (transisi): jika belum ada Expense, pakai totalCost Stocking + Feed
 *   sebagai PROVISIONAL_* (hindari double-count).
 * Saat Expense API penuh: ExpenseEvent wajib menjadi sumber biaya kanonik;
 * totalCost Stocking/Feed bukan desain permanen BOP (Owner 2026-07-19).
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContext } from '../../../erp/tenant.context';
import type { CostClass } from '../../domain/enums';
import type { CostLine } from '@tumbu/domain';
import {
  computeBop,
  computeDeviation,
  computeFcr,
  computeHpp,
  computeProfit,
  computeSr,
  colorFromRule,
} from '@tumbu/domain';

/** KB-05 default: BOP deviation ≤ 0% over target → green (strict: only at-or-under). */
const DEFAULT_BOP_DEV_GREEN_BOUND = 0.0001;
/** KB-05 default: BOP deviation ≤ 10% over target → yellow; > 10% → red. */
const DEFAULT_BOP_DEV_YELLOW_BOUND = 10;

function dec(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class CycleFormulaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  async forCycle(cycleId: string) {
    const tid = this.tid();
    const cycle = await this.prisma.aquaCultureCycle.findFirst({
      where: { id: cycleId, tenantId: tid },
    });
    if (!cycle) throw new NotFoundException('Siklus tidak ditemukan.');

    const [stocking, feeds, harvests, expenses, revenues, rules] =
      await Promise.all([
        this.prisma.aquaStockingEvent.findMany({
          where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
        }),
        this.prisma.aquaFeedEvent.findMany({
          where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
        }),
        this.prisma.aquaHarvestEvent.findMany({
          where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
        }),
        this.prisma.aquaExpenseEvent.findMany({
          where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
          include: { category: true },
        }),
        this.prisma.aquaRevenueEvent.findMany({
          where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
        }),
        this.prisma.aquaIndicatorRule.findMany({
          where: {
            tenantId: tid,
            isActive: true,
            OR: [
              { speciesProfileId: null },
              { speciesProfileId: cycle.speciesProfileId },
            ],
          },
        }),
      ]);

    const costLines = this.assembleCostLines(stocking, feeds, expenses);
    const bop = computeBop(costLines);

    const feedKg = feeds.reduce((s, e) => s + dec(e.quantityKg), 0);
    const harvestKg = harvests.reduce((s, e) => s + dec(e.quantityKg), 0);
    const stockedPcs = stocking.reduce((s, e) => s + dec(e.quantityPcs), 0);
    const harvestedPcs = harvests.reduce((s, e) => s + dec(e.quantityPcs), 0);
    const revenue = revenues.reduce((s, e) => s + dec(e.amount), 0);

    const hpp = computeHpp(bop.total, harvestKg);
    const fcr = computeFcr(feedKg, harvestKg);
    const sr = computeSr(stockedPcs, harvestedPcs);
    const profit = computeProfit(revenue, bop.total);

    const targetBop = dec(cycle.targetBopAmount);
    const targetFcr = dec(cycle.targetFcr);
    const targetSr = dec(cycle.targetSrPct);
    const targetHarvest = dec(cycle.targetHarvestKg);

    const deviations = {
      bop: computeDeviation(bop.total, targetBop),
      fcr: fcr.defined
        ? computeDeviation(fcr.fcr!, targetFcr)
        : computeDeviation(0, targetFcr),
      sr: sr.defined
        ? computeDeviation(sr.srPct!, targetSr)
        : computeDeviation(0, targetSr),
      harvestKg: computeDeviation(harvestKg, targetHarvest),
    };

    const ruleMap = new Map(rules.map((r) => [r.metricCode, r]));
    const colors = {
      fcr: this.colorMetric('FCR', fcr.fcr, ruleMap, 'LOWER_BETTER'),
      sr: this.colorMetric('SR', sr.srPct, ruleMap, 'HIGHER_BETTER'),
      bopDeviation: this.colorDeviation(
        'BOP_DEV',
        deviations.bop.deviationPct,
        ruleMap,
      ),
    };

    return {
      cycleId,
      state: cycle.state,
      facts: {
        feedKg,
        harvestKg,
        stockedPcs,
        harvestedPcs,
        revenue,
        expenseCount: expenses.length,
        bopSource:
          expenses.length > 0 ? 'EXPENSE' : costLines.length > 0
            ? 'PROVISIONAL_EVENT_COSTS'
            : 'EMPTY',
      },
      bop,
      hpp,
      fcr,
      sr,
      profit,
      targets: {
        bop: targetBop || null,
        fcr: targetFcr || null,
        srPct: targetSr || null,
        harvestKg: targetHarvest || null,
      },
      deviations,
      colors,
      /** Tidak ada write — snapshot derived saja */
      computedAt: new Date().toISOString(),
    };
  }

  private assembleCostLines(
    stocking: Array<{ totalCost: unknown }>,
    feeds: Array<{ totalCost: unknown }>,
    expenses: Array<{
      amount: unknown;
      source: string | null;
      category: { costClass: string; code: string };
    }>,
  ): CostLine[] {
    const lines: CostLine[] = [];

    for (const e of expenses) {
      lines.push({
        amount: dec(e.amount),
        costClass: (e.category.costClass as CostClass) || 'DIRECT',
        source: e.source?.trim() || 'EXPENSE',
        categoryCode: e.category.code,
      });
    }

    // Interim: jangan double-count jika Expense sudah ada
    if (expenses.length === 0) {
      for (const s of stocking) {
        const c = dec(s.totalCost);
        if (c > 0) {
          lines.push({
            amount: c,
            costClass: 'DIRECT',
            source: 'PROVISIONAL_STOCKING',
            categoryCode: 'BENIH',
          });
        }
      }
      for (const f of feeds) {
        const c = dec(f.totalCost);
        if (c > 0) {
          lines.push({
            amount: c,
            costClass: 'DIRECT',
            source: 'PROVISIONAL_FEED',
            categoryCode: 'PAKAN',
          });
        }
      }
    }

    return lines;
  }

  private colorMetric(
    code: string,
    value: number | undefined,
    rules: Map<string, { direction: string; greenBound: unknown; yellowBound: unknown }>,
    fallbackDirection: 'LOWER_BETTER' | 'HIGHER_BETTER',
  ) {
    if (value == null || !Number.isFinite(value)) return 'NEUTRAL' as const;
    const rule = rules.get(code);
    if (!rule) return 'NEUTRAL' as const;
    return colorFromRule({
      direction:
        (rule.direction as 'LOWER_BETTER' | 'HIGHER_BETTER') || fallbackDirection,
      greenBound: dec(rule.greenBound),
      yellowBound: dec(rule.yellowBound),
      value,
    });
  }

  private colorDeviation(
    code: string,
    deviationPct: number | undefined,
    rules: Map<string, { direction: string; greenBound: unknown; yellowBound: unknown }>,
  ) {
    if (deviationPct == null || !Number.isFinite(deviationPct)) {
      return 'NEUTRAL' as const;
    }
    const rule = rules.get(code);
    // Default KB-05 BOP: hijau ≤0%, kuning ≤10%, merah >10% over target
    // Map absolute overshoot: value = max(0, deviationPct) as LOWER_BETTER vs bounds
    const overshoot = Math.max(0, deviationPct);
    if (!rule) {
      return colorFromRule({
        direction: 'LOWER_BETTER',
        greenBound: DEFAULT_BOP_DEV_GREEN_BOUND,
        yellowBound: DEFAULT_BOP_DEV_YELLOW_BOUND,
        value: overshoot,
      });
    }
    return colorFromRule({
      direction: (rule.direction as 'LOWER_BETTER' | 'HIGHER_BETTER') || 'LOWER_BETTER',
      greenBound: dec(rule.greenBound),
      yellowBound: dec(rule.yellowBound),
      value: overshoot,
    });
  }
}
