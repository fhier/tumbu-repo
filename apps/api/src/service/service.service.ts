import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../erp/tenant.context';
import { escapeHtml } from '../common/html.util';
import { hashPassword } from '../auth/crypto.util';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContext) {}

  private tid() { return this.tenant.tryTenantId(); }
  private num(v: Prisma.Decimal | number | null | undefined) { return v == null ? 0 : Number(v); }
  private e(v: unknown) { return escapeHtml(v); }

  private async nextNumber(docType: string, prefix: string) {
    const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const row = await this.prisma.docCounter.upsert({
      where: { tenantId_docType_yymmdd: { tenantId: this.tid(), docType, yymmdd } },
      create: { tenantId: this.tid(), docType, yymmdd, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    return `${prefix}-${yymmdd}-${String(row.lastSeq).padStart(4, '0')}`;
  }

  private printShell(title: string, body: string, company: { name: string; phone?: string | null; address?: string | null }) {
    const safeTitle = this.e(title);
    return {
      title,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>body{font-family:system-ui,sans-serif;color:#1A1F2C;padding:24px;max-width:800px;margin:0 auto}
h1{font-size:18px;margin:0 0 4px;color:#0A2E63}.meta{color:#64748B;font-size:12px;margin-bottom:18px}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #E5E7EB;padding:8px;font-size:12px;text-align:left}
th{background:#F1F5F9}.tot{font-weight:700;color:#0A2E63}.actions{margin-top:20px}
@media print{.actions{display:none}}</style></head><body>
<div><strong style="color:#0A2E63;font-size:16px">${this.e(company.name)}</strong>
<div class="meta">${this.e(company.address || '')} ${company.phone ? '· ' + this.e(company.phone) : ''}</div>
<h1>${safeTitle}</h1>${body}
<div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button></div>
</body></html>`,
    };
  }

  async dashboard() {
    const tid = this.tid();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const orders = await this.prisma.workOrder.findMany({ where: { tenantId: tid } });
    const cash = await this.prisma.cashEntry.findMany({ where: { tenantId: tid } });
    const today = orders.filter((o) => o.createdAt >= start);
    const revenue = orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + this.num(o.total), 0);
    const expenses = cash.filter((c) => c.direction === 'OUT').reduce((s, o) => s + this.num(o.amount), 0);
    const cashBal = cash.reduce((s, c) => s + (c.direction === 'IN' ? this.num(c.amount) : -this.num(c.amount)), 0);
    const receivables = orders.filter((o) => o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED').reduce((s, o) => s + this.num(o.total), 0);
    const workload: Record<string, number> = {};
    for (const o of orders.filter((x) => ['SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(x.status) && x.assignedTo)) {
      workload[o.assignedTo!] = (workload[o.assignedTo!] || 0) + 1;
    }
    return {
      ordersToday: today.length,
      scheduled: orders.filter((o) => o.status === 'SCHEDULED').length,
      inProgress: orders.filter((o) => ['IN_PROGRESS', 'ON_THE_WAY'].includes(o.status)).length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      revenue, expenses, receivables, cashBalance: cashBal, workload,
    };
  }

  listCustomers() {
    return this.prisma.partner.findMany({ where: { tenantId: this.tid(), type: 'CUSTOMER' }, orderBy: { name: 'asc' } });
  }

  async createCustomer(input: { name?: string; phone?: string; address?: string; notes?: string } = {}) {
    if (!input.name?.trim()) throw new BadRequestException('Nama pelanggan wajib.');
    return this.prisma.partner.create({
      data: {
        tenantId: this.tid(), name: input.name.trim(), phone: input.phone || null,
        address: input.address || null, notes: input.notes || null, type: 'CUSTOMER',
      },
    });
  }

  listServices() {
    return this.prisma.serviceItem.findMany({ where: { tenantId: this.tid() }, orderBy: { name: 'asc' } });
  }

  async createService(input: { name?: string; category?: string; unit?: string; price?: number; description?: string } = {}) {
    if (!input.name?.trim()) throw new BadRequestException('Nama layanan wajib.');
    return this.prisma.serviceItem.create({
      data: {
        tenantId: this.tid(), name: input.name.trim(), category: input.category || 'GENERAL',
        unit: input.unit || 'unit', price: input.price || 0, description: input.description || null,
      },
    });
  }

  listOrders() {
    return this.prisma.workOrder.findMany({
      where: { tenantId: this.tid() }, include: { lines: true }, orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(id: string) {
    const o = await this.prisma.workOrder.findFirst({ where: { id, tenantId: this.tid() }, include: { lines: true } });
    if (!o) throw new BadRequestException('Pesanan tidak ditemukan.');
    return o;
  }

  async createOrder(input: {
    customerName?: string; customerPhone?: string; serviceAddress?: string; partnerId?: string;
    scheduleAt?: string; assignedTo?: string; status?: string; paymentStatus?: string;
    discount?: number; extraCost?: number; notes?: string; beforeNotes?: string; afterNotes?: string;
    assetUnitId?: string;
    lines?: Array<{ description?: string; itemType?: string; quantity?: number; unit?: string; unitPrice?: number }>;
  } = {}) {
    if (!input.customerName?.trim()) throw new BadRequestException('Nama pelanggan wajib.');
    const lines = (input.lines || []).filter((l) => l.description);
    if (!lines.length) throw new BadRequestException('Minimal satu baris layanan.');
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unitPrice || 0), 0);
    const discount = Number(input.discount || 0);
    const extra = Number(input.extraCost || 0);
    const total = Math.max(0, subtotal - discount + extra);
    const number = await this.nextNumber('WORK_ORDER', 'WO');
    return this.prisma.workOrder.create({
      data: {
        tenantId: this.tid(), number,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone || null,
        serviceAddress: input.serviceAddress || null,
        partnerId: input.partnerId || null,
        assetUnitId: input.assetUnitId || null,
        scheduleAt: input.scheduleAt ? new Date(input.scheduleAt) : null,
        assignedTo: input.assignedTo || null,
        status: input.status || 'NEW',
        paymentStatus: input.paymentStatus || 'UNPAID',
        subtotal, discount, extraCost: extra, total,
        notes: input.notes || null, beforeNotes: input.beforeNotes || null, afterNotes: input.afterNotes || null,
        lines: {
          create: lines.map((l) => ({
            description: String(l.description),
            itemType: l.itemType || null,
            quantity: l.quantity || 1,
            unit: l.unit || 'unit',
            unitPrice: l.unitPrice || 0,
            amount: Number(l.quantity || 1) * Number(l.unitPrice || 0),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async updateOrderStatus(id: string, input: { status?: string; assignedTo?: string; scheduleAt?: string; afterNotes?: string } = {}) {
    const o = await this.getOrder(id);
    const updated = await this.prisma.workOrder.update({
      where: { id: o.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo || null } : {}),
        ...(input.scheduleAt !== undefined ? { scheduleAt: input.scheduleAt ? new Date(input.scheduleAt) : null } : {}),
        ...(input.afterNotes !== undefined ? { afterNotes: input.afterNotes } : {}),
      },
      include: { lines: true },
    });
    if (input.status === 'COMPLETED' && o.assetUnitId) {
      await this.prisma.assetUnit.update({
        where: { id: o.assetUnitId },
        data: {
          lastServiceAt: new Date(),
          nextServiceAt: new Date(Date.now() + 90 * 86400000),
        },
      });
    }
    return updated;
  }

  async updatePayment(id: string, input: { paymentStatus?: string; account?: string } = {}) {
    const o = await this.getOrder(id);
    const next = input.paymentStatus || o.paymentStatus;
    const updated = await this.prisma.workOrder.update({
      where: { id: o.id },
      data: { paymentStatus: next },
      include: { lines: true },
    });
    if (next === 'PAID' && o.paymentStatus !== 'PAID') {
      await this.prisma.cashEntry.create({
        data: {
          tenantId: this.tid(), category: 'Penjualan Jasa', description: `Pembayaran ${o.number}`,
          amount: o.total, direction: 'IN', account: input.account === 'BANK' ? 'BANK' : 'CASH',
        },
      });
    }
    return updated;
  }

  listAssets() {
    return this.prisma.assetUnit.findMany({ where: { tenantId: this.tid() }, orderBy: { updatedAt: 'desc' } });
  }

  async assetHistory(assetUnitId: string) {
    const asset = await this.prisma.assetUnit.findFirst({ where: { id: assetUnitId, tenantId: this.tid() } });
    if (!asset) throw new BadRequestException('Unit AC tidak ditemukan.');
    const orders = await this.prisma.workOrder.findMany({
      where: { tenantId: this.tid(), assetUnitId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
    return { asset, history: orders };
  }

  async createAsset(input: {
    partnerId?: string; locationLabel?: string; brand?: string; acType?: string;
    capacity?: string; serialNumber?: string; notes?: string; nextServiceAt?: string;
  } = {}) {
    if (!input.locationLabel?.trim()) throw new BadRequestException('Lokasi/ruangan wajib.');
    return this.prisma.assetUnit.create({
      data: {
        tenantId: this.tid(), partnerId: input.partnerId || null,
        locationLabel: input.locationLabel.trim(), brand: input.brand || null,
        acType: input.acType || null, capacity: input.capacity || null,
        serialNumber: input.serialNumber || null, notes: input.notes || null,
        nextServiceAt: input.nextServiceAt ? new Date(input.nextServiceAt) : null,
      },
    });
  }

  async listMembers() {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId: this.tid() },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ id: m.id, role: m.role, userId: m.userId, name: m.user.name, email: m.user.email }));
  }

  async inviteMember(input: { email?: string; name?: string; password?: string; role?: string } = {}) {
    if (!input.email?.trim() || !input.name?.trim()) throw new BadRequestException('Nama dan email wajib.');
    const role = (input.role || 'STAFF').toUpperCase();
    if (!['OWNER', 'ADMIN', 'STAFF', 'TECHNICIAN'].includes(role)) throw new BadRequestException('Role tidak valid.');
    const tempPassword = String(input.password || '').trim() || `Tumbu${randomBytes(3).toString('hex')}!`;
    if (tempPassword.length < 8) throw new BadRequestException('Kata sandi minimal 8 karakter.');
    const passwordHash = hashPassword(tempPassword);
    const email = input.email.trim().toLowerCase();
    const tenantId = this.tid();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: input.name.trim(), role, tenantId, passwordHash },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: input.name.trim(), passwordHash },
      });
    }
    await this.prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      update: { role },
      create: { userId: user.id, tenantId, role },
    });
    const members = await this.listMembers();
    return { members, invited: { email, name: input.name.trim(), role, temporaryPassword: tempPassword } };
  }

  async financeSummary() {
    const cash = await this.prisma.cashEntry.findMany({ where: { tenantId: this.tid() } });
    const orders = await this.prisma.workOrder.findMany({ where: { tenantId: this.tid() } });
    const sum = (dir: string, acc?: string) => cash
      .filter((c) => c.direction === dir && (!acc || c.account === acc))
      .reduce((s, c) => s + this.num(c.amount), 0);
    const revenue = orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + this.num(o.total), 0);
    const expenses = sum('OUT');
    return {
      revenue, expenses, grossProfit: revenue - expenses,
      cashBalance: sum('IN', 'CASH') - sum('OUT', 'CASH'),
      bankBalance: sum('IN', 'BANK') - sum('OUT', 'BANK'),
      receivables: orders.filter((o) => o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED')
        .map((o) => ({ number: o.number, partner: o.customerName, total: this.num(o.total), date: o.createdAt.toISOString(), status: o.paymentStatus })),
    };
  }

  async report(input: { from?: string; to?: string } = {}) {
    const from = input.from ? new Date(input.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = input.to ? new Date(input.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const orders = await this.prisma.workOrder.findMany({
      where: { tenantId: this.tid(), createdAt: { gte: from, lte: to } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
    const cash = await this.prisma.cashEntry.findMany({
      where: { tenantId: this.tid(), date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    });
    return {
      from: from.toISOString(), to: to.toISOString(),
      orderCount: orders.length,
      revenue: orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + this.num(o.total), 0),
      expenses: cash.filter((c) => c.direction === 'OUT').reduce((s, c) => s + this.num(c.amount), 0),
      orders, cash,
    };
  }

  private async company() {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: this.tid() } });
  }

  async documentWorkOrder(id?: string) {
    if (!id) throw new BadRequestException('ID wajib.');
    const o = await this.getOrder(id);
    const c = await this.company();
    const rows = o.lines.map((l) => `<tr><td>${this.e(l.description)}</td><td>${this.e(l.itemType || '-')}</td><td>${this.num(l.quantity)} ${this.e(l.unit)}</td><td>${this.num(l.unitPrice).toLocaleString('id-ID')}</td><td>${this.num(l.amount).toLocaleString('id-ID')}</td></tr>`).join('');
    return this.printShell(`Work Order ${o.number}`, `
      <div class="meta">Tanggal: ${this.e(o.createdAt.toLocaleString('id-ID'))} · Status: ${this.e(o.status)} · Jadwal: ${o.scheduleAt ? this.e(o.scheduleAt.toLocaleString('id-ID')) : '-'} · Teknisi: ${this.e(o.assignedTo || '-')}</div>
      <p><b>Pelanggan:</b> ${this.e(o.customerName)} ${this.e(o.customerPhone || '')}<br/><b>Alamat:</b> ${this.e(o.serviceAddress || '-')}</p>
      <table><thead><tr><th>Layanan</th><th>Item</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="tot">Total: Rp ${this.num(o.total).toLocaleString('id-ID')} · Pembayaran: ${this.e(o.paymentStatus)}</p>
      <p>Catatan: ${this.e(o.notes || '-')}</p>`, c);
  }

  async documentInvoice(id?: string) {
    if (!id) throw new BadRequestException('ID wajib.');
    const o = await this.getOrder(id);
    const c = await this.company();
    const rows = o.lines.map((l) => `<tr><td>${this.e(l.description)}</td><td>${this.num(l.quantity)}</td><td>${this.num(l.unitPrice).toLocaleString('id-ID')}</td><td>${this.num(l.amount).toLocaleString('id-ID')}</td></tr>`).join('');
    return this.printShell(`Invoice ${o.number}`, `
      <div class="meta">Tanggal: ${this.e(o.createdAt.toLocaleString('id-ID'))} · Status bayar: ${this.e(o.paymentStatus)}</div>
      <p><b>Tagihan kepada:</b> ${this.e(o.customerName)}<br/>${this.e(o.serviceAddress || '')}</p>
      <table><thead><tr><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
      <p>Subtotal: ${this.num(o.subtotal).toLocaleString('id-ID')} · Diskon: ${this.num(o.discount).toLocaleString('id-ID')} · Biaya lain: ${this.num(o.extraCost).toLocaleString('id-ID')}</p>
      <p class="tot">TOTAL: Rp ${this.num(o.total).toLocaleString('id-ID')}</p>`, c);
  }

  async documentReceipt(id?: string) {
    if (!id) throw new BadRequestException('ID wajib.');
    const o = await this.getOrder(id);
    if (o.paymentStatus !== 'PAID') throw new BadRequestException('Kwitansi hanya untuk pesanan lunas.');
    const c = await this.company();
    return this.printShell(`Kwitansi ${o.number}`, `
      <div class="meta">Tanggal: ${this.e(new Date().toLocaleString('id-ID'))}</div>
      <p>Telah diterima dari <b>${this.e(o.customerName)}</b> pembayaran sebesar:</p>
      <p class="tot">Rp ${this.num(o.total).toLocaleString('id-ID')}</p>
      <p>Untuk: jasa sesuai Work Order ${this.e(o.number)}</p>`, c);
  }

  listQuotations() {
    return this.prisma.quotation.findMany({ where: { tenantId: this.tid() }, orderBy: { createdAt: 'desc' } });
  }

  async createQuotation(input: {
    customerName?: string; customerPhone?: string; serviceAddress?: string; notes?: string;
    discount?: number; validUntil?: string;
    lines?: Array<{ description?: string; quantity?: number; unitPrice?: number }>;
  } = {}) {
    if (!input.customerName?.trim()) throw new BadRequestException('Nama pelanggan wajib.');
    const lines = (input.lines || []).filter((l) => l.description);
    if (!lines.length) throw new BadRequestException('Minimal satu baris penawaran.');
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unitPrice || 0), 0);
    const discount = Number(input.discount || 0);
    const total = Math.max(0, subtotal - discount);
    const number = await this.nextNumber('QUOTATION', 'QT');
    return this.prisma.quotation.create({
      data: {
        tenantId: this.tid(), number,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone || null,
        serviceAddress: input.serviceAddress || null,
        notes: input.notes || null,
        discount, subtotal, total,
        status: 'SENT',
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        linesJson: JSON.stringify(lines.map((l) => ({
          description: l.description, quantity: Number(l.quantity || 1), unitPrice: Number(l.unitPrice || 0),
          amount: Number(l.quantity || 1) * Number(l.unitPrice || 0),
        }))),
      },
    });
  }

  async convertQuotation(id: string) {
    const q = await this.prisma.quotation.findFirst({ where: { id, tenantId: this.tid() } });
    if (!q) throw new BadRequestException('Penawaran tidak ditemukan.');
    if (['REJECTED', 'EXPIRED'].includes(q.status)) throw new BadRequestException('Penawaran sudah ditolak/kedaluwarsa.');
    if (q.status === 'ACCEPTED' && q.workOrderId) throw new BadRequestException('Penawaran sudah dikonversi.');
    const lines = JSON.parse(q.linesJson || '[]') as Array<{ description: string; quantity: number; unitPrice: number }>;
    const order = await this.createOrder({
      customerName: q.customerName,
      customerPhone: q.customerPhone || undefined,
      serviceAddress: q.serviceAddress || undefined,
      discount: this.num(q.discount),
      notes: `Dari penawaran ${q.number}`,
      status: 'SCHEDULED',
      lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
    });
    await this.prisma.quotation.update({ where: { id: q.id }, data: { status: 'ACCEPTED', workOrderId: order.id } });
    return order;
  }

  async updateQuotationStatus(id: string, input: { status?: string } = {}) {
    const q = await this.prisma.quotation.findFirst({ where: { id, tenantId: this.tid() } });
    if (!q) throw new BadRequestException('Penawaran tidak ditemukan.');
    const status = String(input.status || '').toUpperCase();
    if (!['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'DRAFT'].includes(status)) {
      throw new BadRequestException('Status penawaran tidak valid.');
    }
    if (status === 'ACCEPTED') return this.convertQuotation(id);
    return this.prisma.quotation.update({ where: { id: q.id }, data: { status } });
  }

  async documentQuotation(id?: string) {
    if (!id) throw new BadRequestException('ID wajib.');
    const q = await this.prisma.quotation.findFirst({ where: { id, tenantId: this.tid() } });
    if (!q) throw new BadRequestException('Penawaran tidak ditemukan.');
    const c = await this.company();
    const lines = JSON.parse(q.linesJson || '[]') as Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
    const rows = lines.map((l) => `<tr><td>${this.e(l.description)}</td><td>${l.quantity}</td><td>${Number(l.unitPrice).toLocaleString('id-ID')}</td><td>${Number(l.amount).toLocaleString('id-ID')}</td></tr>`).join('');
    return this.printShell(`Penawaran ${q.number}`, `
      <div class="meta">Status: ${this.e(q.status)} · Berlaku s/d: ${q.validUntil ? this.e(q.validUntil.toLocaleDateString('id-ID')) : '-'}</div>
      <p><b>Kepada:</b> ${this.e(q.customerName)}<br/>${this.e(q.serviceAddress || '')}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="tot">Total: Rp ${this.num(q.total).toLocaleString('id-ID')}</p>
      <p>${this.e(q.notes || '')}</p>`, c);
  }
}
