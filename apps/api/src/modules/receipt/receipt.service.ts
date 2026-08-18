import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../erp/tenant.context';
import * as db from '../../db';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tryTenantId();
  }

  async getCanonicalData(transactionId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, tenantId: this.tid() },
      include: { items: true, fees: true },
    });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');
    
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: this.tid() } });
    
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const pmap = new Map(products.map((p) => [p.id, p]));
    
    return {
      business: { name: tenant.name, contact: tenant.phone },
      number: tx.number,
      date: tx.date.toISOString(),
      partner: tx.partner,
      user: 'Kasir',
      items: tx.items.map(it => {
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
          // Additional sampling data if stored in metaJson? Assuming logic in items
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
    const tx = await this.prisma.transaction.findFirst({ where: { id: transactionId, tenantId: this.tid() } });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');

    const token = uuidv4();
    db.writeWorkspaceSetting(`share_token_${token}`, `${transactionId}|${this.tid()}`);
    return token;
  }

  async getSharedData(token: string) {
    const val = db.readWorkspaceSetting(`share_token_${token}`);
    if (!val) throw new BadRequestException('Link tidak valid.');
    
    const [transactionId, txTenantId] = val.split('|');
    
    // Check if transaction belongs to the tenant who created the token (isolation check)
    const tx = await this.prisma.transaction.findFirst({ where: { id: transactionId, tenantId: txTenantId } });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');
    
    return this.getCanonicalData(transactionId);
  }
}
