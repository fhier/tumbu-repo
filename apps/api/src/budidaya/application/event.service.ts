// @ts-nocheck
/**
 * Event Slice — Stocking, Feed, Mortality, Sampling, Medicine, Expense, Harvest, Close.
 *
 * Traceability (Sprint 1 / Doc 65 §4):
 * - Docs 56·57·58·62 · Journey J1–J5 · Module budidaya
 *
 * Prinsip Owner:
 * - append-only (create + void — tidak rewrite histori kuantitas)
 * - event memicu CycleTransitionService (bukan set state langsung)
 * - tidak menghitung KPI / Formula
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import { CycleTransitionService } from '../workflow/cycle-transition.service';
import { assertEventAllowedOnState } from '../workflow/event-guards';
import { MEDICINE_KINDS } from '../domain/enums';
import { canRecordMortality, canRecordHarvestPcs } from '@tumbu/domain';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CycleFormulaService } from '../formula/services/cycle-formula.service';

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

function requireDec(v: unknown, label: string): number {
  const n = optDec(v);
  if (n == null) throw new BadRequestException(`${label} wajib.`);
  return n;
}

function parseEventAt(v: unknown): Date {
  if (v === undefined || v === null || v === '') return new Date();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new BadRequestException('eventAt tidak valid.');
  return d;
}

@Injectable()
export class BudidayaEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
    private readonly transitions: CycleTransitionService,
    private readonly emitter: EventEmitter2,
    private readonly formulaService: CycleFormulaService,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  private actor(): string {
    return this.tenant.userId || 'system';
  }

  private async requireCycle(cycleId: string) {
    const cycle = await this.prisma.aquaCultureCycle.findFirst({
      where: { id: cycleId, tenantId: this.tid() },
    });
    if (!cycle) throw new NotFoundException('Siklus tidak ditemukan.');
    return cycle;
  }

  // —— Stocking ——
  async createStocking(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('STOCKING', cycle.state);

    const existing = await this.prisma.aquaStockingEvent.findFirst({
      where: { cycleId, tenantId: this.tid(), recordStatus: 'RECORDED' },
    });
    if (existing) {
      throw new BadRequestException(
        'V1 hanya mengizinkan satu StockingEvent RECORDED per siklus.',
      );
    }

    const quantityPcs = requireDec(input.quantityPcs, 'quantityPcs');
    if (quantityPcs <= 0) throw new BadRequestException('quantityPcs harus > 0.');

    const event = await this.prisma.aquaStockingEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        quantityPcs,
        averageWeightGram: optDec(input.averageWeightGram) ?? undefined,
        unitCost: optDec(input.unitCost) ?? undefined,
        totalCost: optDec(input.totalCost) ?? undefined,
      },
    });

    // Event → TransitionService → ACTIVE (bukan set state di controller)
    const cycleAfter = await this.transitions.transition({
      cycleId,
      tenantId: this.tid(),
      to: 'ACTIVE',
      trigger: 'STOCKING_EVENT',
    });

    return { event, cycle: cycleAfter };
  }

  async voidStocking(_eventId: string, _reason?: string) {
    throw new BadRequestException(
      'Void StockingEvent tidak didukung di V1 setelah transisi ke ACTIVE (tidak ada reverse transition). Batalkan siklus bila perlu.',
    );
  }

  // —— Feed ——
  async createFeed(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('FEED', cycle.state);

    const feedTypeId = str(input.feedTypeId);
    if (!feedTypeId) throw new BadRequestException('feedTypeId wajib.');
    const feedType = await this.prisma.aquaFeedType.findFirst({
      where: { id: feedTypeId, tenantId: this.tid(), isActive: true },
    });
    if (!feedType) throw new BadRequestException('Jenis pakan tidak ditemukan / nonaktif.');

    const quantityKg = requireDec(input.quantityKg, 'quantityKg');
    if (quantityKg <= 0) throw new BadRequestException('quantityKg harus > 0.');

    const event = await this.prisma.aquaFeedEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        feedTypeId,
        quantityKg,
        unitCost: optDec(input.unitCost) ?? undefined,
        totalCost: optDec(input.totalCost) ?? undefined,
      },
    });
    // Tidak ada transisi state; tidak hitung FCR/BOP
    return { event, cycle };
  }

  async voidFeed(eventId: string, reason?: string) {
    return this.voidOperationalEvent('aquaFeedEvent', eventId, reason, 'FeedEvent');
  }

  private async voidOperationalEvent(
    model:
      | 'aquaFeedEvent'
      | 'aquaMortalityEvent'
      | 'aquaSamplingEvent'
      | 'aquaMedicineEvent'
      | 'aquaExpenseEvent'
      | 'aquaHarvestEvent',
    eventId: string,
    reason: string | undefined,
    notFoundLabel: string,
  ) {
    const event = await (this.prisma[model] as {
      findFirst: (args: object) => Promise<{
        id: string;
        cycleId: string;
        recordStatus: string;
      } | null>;
      update: (args: object) => Promise<unknown>;
    }).findFirst({
      where: { id: eventId, tenantId: this.tid() },
    });
    if (!event) throw new NotFoundException(`${notFoundLabel} tidak ditemukan.`);
    if (event.recordStatus === 'VOIDED') {
      throw new BadRequestException('Event sudah VOIDED.');
    }
    const cycle = await this.requireCycle(event.cycleId);
    if (cycle.state === 'CLOSED' || cycle.state === 'CANCELLED') {
      throw new BadRequestException('Tidak dapat void event pada siklus terminal.');
    }
    const updated = await (this.prisma[model] as {
      updateMany: (args: object) => Promise<{ count: number }>;
    }).updateMany({
      where: { id: event.id, tenantId: this.tid() },
      data: {
        recordStatus: 'VOIDED',
        voidedAt: new Date(),
        voidedBy: this.actor(),
        voidReason: optStr(reason) ?? 'void',
      },
    });
    if (updated.count === 0) throw new NotFoundException(`${notFoundLabel} tidak ditemukan atau Anda tidak memiliki akses.`);
    
    // Fetch the updated record since updateMany doesn't return it
    const eventResult = await (this.prisma[model] as {
      findUnique: (args: object) => Promise<unknown>;
    }).findUnique({ where: { id: event.id } });
    
    return { event: eventResult };
  }

  // —— Mortality ——
  async createMortality(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('MORTALITY', cycle.state);

    const deadCountPcs = requireDec(input.deadCountPcs, 'deadCountPcs');
    if (deadCountPcs <= 0) throw new BadRequestException('deadCountPcs harus > 0.');

    const tid = this.tid();
    const [stocking, mortalities, harvests] = await Promise.all([
      this.prisma.aquaStockingEvent.findMany({
        where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
      }),
      this.prisma.aquaMortalityEvent.findMany({
        where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
      }),
      this.prisma.aquaHarvestEvent.findMany({
        where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
      }),
    ]);

    const stockedPcs = stocking.reduce((s, e) => s + Number(e.quantityPcs || 0), 0);
    const deadPcs = mortalities.reduce((s, e) => s + Number(e.deadCountPcs || 0), 0);
    const harvestedPcs = harvests.reduce((s, e) => s + Number(e.quantityPcs || 0), 0);

    const check = canRecordMortality(
      { stockedPcs, deadPcs, harvestedPcs },
      deadCountPcs,
    );
    if (!check.ok) {
      throw new BadRequestException(check.reason);
    }

    const event = await this.prisma.aquaMortalityEvent.create({
      data: {
        tenantId: tid,
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        deadCountPcs,
        cause: optStr(input.cause) ?? undefined,
      },
    });
    return {
      event,
      cycle,
      population: {
        activeBefore: check.activeBefore,
        activeAfter: check.activeAfter,
        stockedPcs,
        deadPcs: deadPcs + deadCountPcs,
        harvestedPcs,
      },
    };
  }

  async voidMortality(eventId: string, reason?: string) {
    return this.voidOperationalEvent(
      'aquaMortalityEvent',
      eventId,
      reason,
      'MortalityEvent',
    );
  }

  // —— Sampling ——
  async createSampling(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('SAMPLING', cycle.state);

    const averageWeightGram = requireDec(input.averageWeightGram, 'averageWeightGram');
    if (averageWeightGram <= 0) {
      throw new BadRequestException('averageWeightGram harus > 0.');
    }

    const event = await this.prisma.aquaSamplingEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        averageWeightGram,
        sampleCountPcs: optDec(input.sampleCountPcs) ?? undefined,
      },
    });
    return { event, cycle };
  }

  async voidSampling(eventId: string, reason?: string) {
    return this.voidOperationalEvent(
      'aquaSamplingEvent',
      eventId,
      reason,
      'SamplingEvent',
    );
  }

  // —— Medicine ——
  async createMedicine(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('MEDICINE', cycle.state);

    const treatmentKind = str(input.treatmentKind || 'OBAT').toUpperCase();
    if (!(MEDICINE_KINDS as readonly string[]).includes(treatmentKind)) {
      throw new BadRequestException(
        `treatmentKind harus salah satu: ${MEDICINE_KINDS.join(', ')}.`,
      );
    }
    const productName = str(input.productName);
    if (!productName) throw new BadRequestException('productName wajib.');

    const event = await this.prisma.aquaMedicineEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        treatmentKind,
        productName,
        quantity: optDec(input.quantity) ?? undefined,
        totalCost: optDec(input.totalCost) ?? undefined,
      },
    });
    return { event, cycle };
  }

  async voidMedicine(eventId: string, reason?: string) {
    return this.voidOperationalEvent(
      'aquaMedicineEvent',
      eventId,
      reason,
      'MedicineEvent',
    );
  }

  // —— Expense ——
  async createExpense(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('EXPENSE', cycle.state);

    const categoryId = str(input.categoryId);
    if (!categoryId) throw new BadRequestException('categoryId wajib.');
    const category = await this.prisma.aquaCostCategory.findFirst({
      where: { id: categoryId, tenantId: this.tid(), isActive: true },
    });
    if (!category) throw new BadRequestException('Kategori biaya tidak ditemukan / nonaktif.');

    const amount = requireDec(input.amount, 'amount');
    if (amount <= 0) throw new BadRequestException('amount harus > 0.');
    const description = str(input.description);
    if (!description) throw new BadRequestException('description wajib.');

    const event = await this.prisma.aquaExpenseEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        categoryId,
        amount,
        description,
        partnerId: optStr(input.partnerId) ?? undefined,
        source: optStr(input.source) ?? undefined,
      },
    });
    return { event, cycle };
  }

  async voidExpense(eventId: string, reason?: string) {
    return this.voidOperationalEvent(
      'aquaExpenseEvent',
      eventId,
      reason,
      'ExpenseEvent',
    );
  }

  // —— Harvest ——
  async createHarvest(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('HARVEST', cycle.state);

    const stockingRows = await this.prisma.aquaStockingEvent.findMany({
      where: { cycleId, tenantId: this.tid(), recordStatus: 'RECORDED' },
    });
    if (!stockingRows.length) {
      throw new BadRequestException('Panen mensyaratkan StockingEvent RECORDED.');
    }

    const quantityKg = requireDec(input.quantityKg, 'quantityKg');
    if (quantityKg <= 0) throw new BadRequestException('quantityKg harus > 0.');

    // KL-003: quantityPcs wajib agar panen mengurangi activePcs
    const quantityPcs = requireDec(input.quantityPcs, 'quantityPcs');

    const tid = this.tid();
    const [mortalities, harvests] = await Promise.all([
      this.prisma.aquaMortalityEvent.findMany({
        where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
      }),
      this.prisma.aquaHarvestEvent.findMany({
        where: { cycleId, tenantId: tid, recordStatus: 'RECORDED' },
      }),
    ]);

    const stockedPcs = stockingRows.reduce((s, e) => s + Number(e.quantityPcs || 0), 0);
    const deadPcs = mortalities.reduce((s, e) => s + Number(e.deadCountPcs || 0), 0);
    const harvestedPcs = harvests.reduce((s, e) => s + Number(e.quantityPcs || 0), 0);

    const popCheck = canRecordHarvestPcs(
      { stockedPcs, deadPcs, harvestedPcs },
      quantityPcs,
    );
    if (!popCheck.ok) {
      throw new BadRequestException(popCheck.reason);
    }

    const event = await this.prisma.aquaHarvestEvent.create({
      data: {
        tenantId: tid,
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
        quantityKg,
        quantityPcs,
        grade: optStr(input.grade) ?? undefined,
      },
    });

    // Domain: panen → HARVESTING (bukan CLOSED). Tutup siklus = CloseEvent terpisah (S06).
    let cycleAfter = cycle;
    if (cycle.state === 'ACTIVE') {
      cycleAfter = await this.transitions.transition({
        cycleId,
        tenantId: tid,
        to: 'HARVESTING',
        trigger: 'HARVEST_EVENT',
      });
    } else if (cycle.state === 'HARVESTING') {
      cycleAfter = await this.transitions.transition({
        cycleId,
        tenantId: tid,
        to: 'HARVESTING',
        trigger: 'HARVEST_EVENT',
      });
    }

    return {
      event,
      cycle: cycleAfter,
      population: {
        activeBefore: popCheck.activeBefore,
        activeAfter: popCheck.activeAfter,
        stockedPcs,
        deadPcs,
        harvestedPcs: harvestedPcs + quantityPcs,
      },
    };
  }

  async voidHarvest(eventId: string, reason?: string) {
    // V1: tidak membalik HARVESTING → ACTIVE — hanya void event.
    return this.voidOperationalEvent('aquaHarvestEvent', eventId, reason, 'HarvestEvent');
  }

  // —— Close ——
  async createClose(cycleId: string, input: Record<string, unknown> = {}) {
    const cycle = await this.requireCycle(cycleId);
    assertEventAllowedOnState('CLOSE', cycle.state);

    const stocking = await this.prisma.aquaStockingEvent.findFirst({
      where: { cycleId, tenantId: this.tid(), recordStatus: 'RECORDED' },
    });
    if (!stocking) {
      throw new BadRequestException('Tutup siklus mensyaratkan StockingEvent RECORDED.');
    }

    const existing = await this.prisma.aquaCycleCloseEvent.findFirst({
      where: { cycleId, tenantId: this.tid() },
    });
    if (existing && existing.recordStatus === 'RECORDED') {
      throw new BadRequestException('Siklus sudah memiliki CycleCloseEvent.');
    }

    const event = await this.prisma.aquaCycleCloseEvent.create({
      data: {
        tenantId: this.tid(),
        cycleId,
        eventAt: parseEventAt(input.eventAt),
        createdBy: this.actor(),
        notes: optStr(input.notes) ?? undefined,
        recordStatus: 'RECORDED',
      },
    });

    const cycleAfter = await this.transitions.transition({
      cycleId,
      tenantId: this.tid(),
      to: 'CLOSED',
      trigger: 'CLOSE_EVENT',
    });

    // Compute KPI snapshot using Formula Service
    const kpi = await this.formulaService.forCycle(cycleId);
    await this.prisma.harvestSummary.upsert({
      where: { cycleId },
      create: {
        cycleId,
        fcr: kpi.fcr,
        srPct: kpi.srPct,
        hpp: kpi.hpp,
        profit: kpi.profit,
      },
      update: {
        fcr: kpi.fcr,
        srPct: kpi.srPct,
        hpp: kpi.hpp,
        profit: kpi.profit,
      },
    });

    // Emit event for ERP to handle post‑sale actions
    this.emitter.emit('harvest.closed', { cycleId });

    return { event, cycle: cycleAfter };
  }

  async listByCycle(cycleId: string) {
    await this.requireCycle(cycleId);
    const tid = this.tid();
    const [stocking, feeds, mortalities, samplings, medicines, expenses, harvests, close] =
      await Promise.all([
        this.prisma.aquaStockingEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaFeedEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaMortalityEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaSamplingEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaMedicineEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaExpenseEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaHarvestEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
        this.prisma.aquaCycleCloseEvent.findMany({
          where: { cycleId, tenantId: tid },
          orderBy: { eventAt: 'asc' },
        }),
      ]);
    return {
      stocking,
      feeds,
      mortalities,
      samplings,
      medicines,
      expenses,
      harvests,
      close,
    };
  }
}

