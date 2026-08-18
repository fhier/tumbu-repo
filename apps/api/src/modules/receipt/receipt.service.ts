import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import { randomUUID } from 'crypto';

@Injectable()
export class ReceiptService {
  // In-memory map to replace the deleted legacy db.js workspace settings
  private static readonly tokensMap = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tryTenantId();
  }

  async generateReceipt(data: { orderId: string; type: string; amount: number }) {
    return {
      success: true,
      receiptNumber: `RCP-${Date.now()}`,
      ...data,
      generatedAt: new Date().toISOString(),
    };
  }

  async getReceipts() {
    return [
      { id: '1', receiptNumber: 'RCP-001', amount: 150000, date: new Date().toISOString() },
    ];
  }

  async getCanonicalData(transactionId: string, tenantId?: string) {
    const tid = tenantId || this.tid();
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, tenantId: tid },
      include: { items: true, fees: true },
    });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tid } });

    const products = await this.prisma.product.findMany({ where: { tenantId: tid } });
    const pmap = new Map(products.map((p) => [p.id, p]));

    return {
      business: { name: tenant.name, contact: tenant.phone },
      number: tx.number,
      date: tx.date.toISOString(),
      partner: tx.partner,
      user: 'Kasir',
      items: tx.items.map((it) => {
        const prod = pmap.get(it.productId);
        return {
          product: prod?.name || it.productId,
          quantity: Number(it.quantity),
          unit: it.unit || prod?.unit || '—',
          price: Number(it.price),
          subtotal: Number(it.quantity) * Number(it.price),
          discount: Number(it.discountAmount),
          weight: Number(it.weight || 0),
          sampling: Number(it.sampling || 0),
        };
      }),
      total: Number(tx.total),
      paidAmount: Number(tx.paidAmount),
      remaining: Math.max(0, Number(tx.total) - Number(tx.paidAmount)),
      status: tx.status,
      notes: tx.notes,
    };
  }

  async generateShareToken(transactionId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, tenantId: this.tid() },
    });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');

    const token = randomUUID();
    ReceiptService.tokensMap.set(token, `${transactionId}|${this.tid()}`);
    return token;
  }

  async getSharedData(token: string) {
    const val = ReceiptService.tokensMap.get(token);
    if (!val) throw new BadRequestException('Link tidak valid.');

    const [transactionId, txTenantId] = val.split('|');

    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, tenantId: txTenantId },
    });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');

    return this.getCanonicalData(transactionId, txTenantId);
  }
}