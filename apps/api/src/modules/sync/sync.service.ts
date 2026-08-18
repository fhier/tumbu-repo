import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  OutboxItem,
  SyncPushRequest,
  SyncPushResponse,
  SyncPushResponseItem,
  SyncPullRequest,
  SyncPullResponse,
} from '@tumbu/core';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import { ErpService } from '../../erp/erp.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly erpService: ErpService,
  ) {}

  /** Translate offline payment labels to the only ERP statuses accepted by totals. */
  private paymentStatus(raw: unknown): 'PAID' | 'DUE' | 'DP' {
    const value = String(raw || 'TUNAI').trim().toUpperCase();
    if (['PAID', 'TUNAI', 'CASH', 'BANK', 'TRANSFER', 'LUNAS'].includes(value)) return 'PAID';
    if (['DUE', 'UNPAID', 'HUTANG', 'PIUTANG'].includes(value)) return 'DUE';
    if (['DP', 'PARTIAL', 'CICILAN'].includes(value)) return 'DP';
    throw new BadRequestException(`Metode/status pembayaran sync tidak dikenali: ${value}.`);
  }

  async processPush(req: SyncPushRequest): Promise<SyncPushResponse> {
    const tenantId = this.tenantContext.tenantId;
    const results: SyncPushResponseItem[] = [];
    let processed = 0;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true }
    });
    const isPending = tenant?.status === 'PENDING';

    for (const item of req.items || []) {
      // 1. Claim Idempotency Key in Database
      let claimed = false;
      try {
        await this.prisma.syncIdempotency.create({
          data: {
            tenantId,
            idempotencyKey: item.id,
            status: 'PROCESSING',
            response: '{}',
          }
        });
        claimed = true;
      } catch (dbErr: any) {
        if (dbErr.code === 'P2002') {
          // Key already claimed by another request.
        } else {
          throw dbErr;
        }
      }

      if (!claimed) {
        let existingIdempotency = await this.prisma.syncIdempotency.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: item.id } },
        });

        if (existingIdempotency && existingIdempotency.status === 'PROCESSING') {
          const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
          const isStale = (Date.now() - existingIdempotency.createdAt.getTime()) > STALE_THRESHOLD_MS;
          
          if (isStale) {
            try {
              const result = await this.prisma.syncIdempotency.updateMany({
                where: { 
                  tenantId, 
                  idempotencyKey: item.id,
                  status: 'PROCESSING',
                  createdAt: existingIdempotency.createdAt
                },
                data: { createdAt: new Date() }
              });
              
              if (result.count > 0) {
                claimed = true;
              }
            } catch (e) {
              // Ignore and fall through to polling
            }
          }
        }

        if (!claimed) {
          let retries = 20; // 10 seconds max wait
          while (retries > 0 && existingIdempotency && existingIdempotency.status === 'PROCESSING') {
            await new Promise((resolve) => setTimeout(resolve, 500));
            existingIdempotency = await this.prisma.syncIdempotency.findUnique({
              where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: item.id } },
            });
            retries--;
          }

          if (existingIdempotency && existingIdempotency.status !== 'PROCESSING') {
            try {
              const parsed = JSON.parse(existingIdempotency.response);
              results.push(parsed);
            } catch {
              results.push({ id: item.id, status: existingIdempotency.status as SyncPushResponseItem['status'] });
            }
            continue;
          } else {
            results.push({ id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Concurrent processing timeout or stale processing' });
            continue;
          }
        }
      }

      try {
        const transactionalAggregates = [
          'FeedEvent', 'MortalityEvent', 'SamplingEvent', 'HarvestEvent',
          'CashEntry', 'SalesOrder', 'DeliveryOrder'
        ];

        if (isPending && transactionalAggregates.includes(item.aggregate)) {
          throw new Error('Workspace belum dapat dipakai (status: PENDING).');
        }

        const res = await this.processItem(tenantId, item);
        
        if (!res.__alreadyHandledIdempotency) {
          await this.prisma.syncIdempotency.update({
            where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: item.id } },
            data: {
              status: res.status,
              response: JSON.stringify(res),
            }
          });
        }

        // Clean up the internal flag before returning
        delete res.__alreadyHandledIdempotency;
        results.push(res);
        processed++;
      } catch (err) {
        if (err instanceof Error && err.name === 'HardCrashError') {
          throw err;
        }
        
        const errItem: SyncPushResponseItem = {
          id: item.id,
          status: 'FAILED_NEEDS_REVIEW',
          error: err instanceof Error ? err.message : 'Gagal memproses sync item',
        };
        
        await this.prisma.syncIdempotency.update({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: item.id } },
          data: {
            status: errItem.status,
            response: JSON.stringify(errItem),
          }
        });
        results.push(errItem);
      }
    }

    return {
      success: true,
      processedCount: processed,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  private async processItem(tenantId: string, item: OutboxItem): Promise<SyncPushResponseItem & { __alreadyHandledIdempotency?: boolean }> {
    this.logger.log(`Processing sync item ${item.id} (${item.aggregate}:${item.operation}) for tenant ${tenantId}`);

    // Logika pengolahan per-aggregate (Append-only untuk transactional, LWW untuk master data)
    switch (item.aggregate) {
      case 'SalesOrder':
        if (item.operation === 'CREATE') {
          const payload = (item.payload || {}) as Record<string, any>;
          if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Payload tidak memiliki items.' };
          }
          if (payload.items.some(i => !i.productId || !i.qty || !i.price)) {
            return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Item harus memiliki productId, qty, dan price.' };
          }
          if (!payload.partnerId) return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Partner wajib diisi.' };
          
          const created = await this.erpService.createTransactionFromSync({
            type: 'SALE',
            partner: String(payload.partnerId),
            status: this.paymentStatus(payload.paymentStatus || payload.paymentMethod),
            date: payload.createdAt ? String(payload.createdAt) : undefined,
            notes: payload.notes || undefined,
            upahSopir: payload.driver ? 0 : 0, // Using meta for driver if needed, but keeping it simple
            items: payload.items.map(i => ({
              productId: String(i.productId),
              quantity: Number(i.qty),
              price: Number(i.price)
            }))
          }, item.id, item.version);
          
          return { id: created.id, status: created.status as any, serverVersion: created.serverVersion, __alreadyHandledIdempotency: true };
        }
        return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: `Operation ${item.operation} not implemented for SalesOrder` };

      case 'DeliveryOrder':
        if (item.operation === 'CREATE') {
          const payload = (item.payload || {}) as Record<string, any>;
          if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Payload tidak memiliki items.' };
          }
          if (payload.items.some(i => !i.productId || !i.qty || !i.price)) {
            return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Item harus memiliki productId, qty, dan price.' };
          }
          if (!payload.partnerId) return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: 'Partner wajib diisi.' };
          
          const fees: Array<{ kind: string; label: string; amount: number }> = [];
          if (payload.transportFee && Number(payload.transportFee) > 0) {
            fees.push({ kind: 'TRANSPORT', label: 'Ongkos Kirim', amount: Number(payload.transportFee) });
          }

          const created = await this.erpService.createTransactionFromSync({
            type: 'PURCHASE',
            partner: String(payload.partnerId),
            status: this.paymentStatus(payload.paymentStatus || payload.paymentMethod),
            date: payload.createdAt ? String(payload.createdAt) : undefined,
            notes: payload.notes || undefined,
            fees: fees.length > 0 ? fees : undefined,
            items: payload.items.map(i => ({
              productId: String(i.productId),
              quantity: Number(i.qty),
              price: Number(i.price)
            }))
          }, item.id, item.version);
          
          return { id: created.id, status: created.status as any, serverVersion: created.serverVersion, __alreadyHandledIdempotency: true };
        }
        return { id: item.id, status: 'FAILED_NEEDS_REVIEW', error: `Operation ${item.operation} not implemented for DeliveryOrder` };

      case 'CashEntry':
        if (item.operation === 'CREATE') {
          const payload = (item.payload || {}) as Record<string, any>;
          try {
            const created = await this.erpService.createCashFromSync({
              category: String(payload.category || ''),
              amount: payload.amount as any, // Passed as is, validation inside createCashFromSync
              description: String(payload.note || ''),
              date: payload.createdAt ? String(payload.createdAt) : undefined,
              direction: 'OUT',
              account: 'CASH',
            }, item.id, item.version);
            this.logger.log(`createCashFromSync success: ${created.id}`);
            return {
              id: item.id,
              status: 'SYNCED',
              serverVersion: item.version,
              __alreadyHandledIdempotency: true // Flag so outer block doesn't double-update
            };
          } catch (e) {
            this.logger.error(`createCash failed: ${e.message}`, e.stack);
            throw e;
          }
        }
        return {
          id: item.id,
          status: 'FAILED_NEEDS_REVIEW',
          error: `Operation ${item.operation} not implemented for CashEntry`,
        };

      case 'Cycle':
      case 'FeedEvent':
      case 'MortalityEvent':
      case 'SamplingEvent':
      case 'HarvestEvent':
        return {
          id: item.id,
          status: 'FAILED_NEEDS_REVIEW',
          error: `Aggregate ${item.aggregate} write operation is not yet implemented.`,
        };


      default:
        return {
          id: item.id,
          status: 'FAILED_NEEDS_REVIEW',
          error: `Unknown aggregate: ${item.aggregate}`,
        };
    }
  }

  async processPull(req: SyncPullRequest): Promise<SyncPullResponse> {
    const tenantId = this.tenantContext.tenantId;
    this.logger.log(`Pulling updates for tenant ${tenantId} since ${req.since}`);

    // Fetch minimum read-model for offline PWA
    const [ponds, cycles, products] = await Promise.all([
      this.prisma.aquaPond.findMany({
        where: { tenantId: tenantId, status: 'ACTIVE' },
        select: { id: true, name: true, code: true, status: true },
      }),
      this.prisma.aquaCultureCycle.findMany({
        where: { tenantId: tenantId, state: { in: ['PLANNED', 'READY', 'ACTIVE', 'HARVESTING'] } },
        select: {
          id: true,
          code: true,
          state: true,
          pondId: true,
          pond: { select: { name: true, code: true } },
          speciesProfileId: true,
          speciesProfile: { select: { name: true, code: true } },
        },
      }),
      this.prisma.aquaFeedType.findMany({
        where: { tenantId: tenantId, isActive: true },
        select: { id: true, name: true, brand: true, unit: true },
      }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      changes: {
        ponds: ponds as unknown as Record<string, unknown>[],
        cycles: cycles as unknown as Record<string, unknown>[],
        products: products as unknown as Record<string, unknown>[],
        partners: [],
        transactions: [],
      },
    };
  }
}
