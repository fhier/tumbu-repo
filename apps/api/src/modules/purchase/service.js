function normalizePurchasePayload(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const normalizedItems = items.map((item) => ({
    ukuran: String(item.ukuran || '').trim(),
    berat: Number(item.berat) || 0,
    sampling: Number(item.sampling) || 0,
    totalEkor: Number(item.totalEkor) || 0,
    hargaEkor: Number(item.hargaEkor) || 0,
    jenisFlase: String(item.jenisFlase || '').trim(),
    persenFlase: Number(item.persenFlase) || 0
  })).filter((item) => item.ukuran);

  const totalPembelian = normalizedItems.reduce((sum, item) => sum + item.totalEkor * item.hargaEkor, 0);
  const totalPotongan = Number(data.plase && data.plase.nominal ? data.plase.nominal : 0) || 0;
  const nominalBayar = Math.max(totalPembelian - totalPotongan, 0);
  const dibayarSekarang = Number(data.dibayarSekarang) || 0;
  const sisaHutang = Math.max(nominalBayar - dibayarSekarang, 0);

  return {
    tanggal: String(data.tanggal || '').trim(),
    supplier: String(data.supplier || '').trim(),
    supplierHp: String(data.supplierHp || '').trim(),
    supplierAlamat: String(data.supplierAlamat || '').trim(),
    items,
    itemsSiap: normalizedItems,
    totalPembelian,
    totalPotongan,
    nominalBayar,
    dibayarSekarang,
    sisaHutang,
    jumlahUkuran: normalizedItems.length,
    totalEkorKeseluruhan: normalizedItems.reduce((sum, item) => sum + item.totalEkor, 0),
    keterangan: String(data.keterangan || '').trim()
  };
}

const { prisma } = require('../../prisma-singleton');

async function createPurchaseTransaction(data = {}, deps = {}) {
  const siap = normalizePurchasePayload(data);
  const noTransaksi = String(data.noTransaksi || `PB${Date.now()}`).trim();
  const stockState = Array.isArray(deps.stockState) ? deps.stockState : [];
  const correlationId = `corr-${Date.now()}-${noTransaksi}`;

  const result = {
    noTransaksi,
    totalEkor: siap.totalEkorKeseluruhan,
    totalPembelian: siap.totalPembelian,
    totalPotongan: siap.totalPotongan,
    nominalBayar: siap.nominalBayar,
    sisaHutang: siap.sisaHutang,
    jumlahUkuran: siap.jumlahUkuran,
    noBA: String(data.noBA || '').trim(),
    payload: siap
  };

  // Financial Persistence
  await prisma.financialEvent.create({
    data: {
      tenantId: data.tenantId || 'default',
      sourceTransactionId: noTransaksi,
      sourceTransactionType: 'PURCHASE',
      eventType: 'INVENTORY_ACQUISITION',
      amount: siap.nominalBayar,
      occurredAt: new Date(),
      correlationId,
      idempotencyKey: `idemp-${noTransaksi}-inv`
    }
  });

  if (siap.dibayarSekarang > 0) {
    await prisma.settlement.create({
      data: {
        tenantId: data.tenantId || 'default',
        sourceTransactionId: noTransaksi,
        amount: siap.dibayarSekarang,
        idempotencyKey: `idemp-${noTransaksi}-set`
      }
    });
  }

  await prisma.journalEntry.create({
    data: {
      tenantId: data.tenantId || 'default',
      eventId: `je-${Date.now()}`,
      lines: {
        create: [
          { accountId: 'INVENTORY', debit: siap.nominalBayar, credit: 0 },
          { accountId: 'CASH', debit: 0, credit: siap.dibayarSekarang },
          { accountId: 'PAYABLE', debit: 0, credit: siap.sisaHutang }
        ]
      }
    }
  });

  if (deps.stockService && typeof deps.stockService.updateStockPembelian === 'function') {
    for (const item of siap.itemsSiap) {
      deps.stockService.updateStockPembelian(stockState, item.ukuran, item.totalEkor);
    }
  }

  if (deps.cashService && typeof deps.cashService.createCashMutation === 'function' && siap.dibayarSekarang > 0) {
    result.cashMutation = await deps.cashService.createCashMutation({
      tanggal: siap.tanggal,
      tipe: 'Keluar',
      kategori: 'Pembelian',
      referensi: noTransaksi,
      nominal: siap.dibayarSekarang,
      keterangan: `Pembayaran pembelian ${siap.supplier} (${noTransaksi})`
    });
  }

  if (deps.debtService && typeof deps.debtService.createDebtEntry === 'function' && siap.sisaHutang > 0) {
    result.debtEntry = deps.debtService.createDebtEntry({
      noTransaksi,
      tanggal: siap.tanggal,
      supplier: siap.supplier,
      totalHutang: siap.nominalBayar,
      totalDibayar: siap.dibayarSekarang,
      sisaHutang: siap.sisaHutang
    });
  }

  return result;
}

async function updatePurchaseTransaction(oldTransactionId, data = {}, deps = {}) {
  // 1. Check existing payments
  const payments = await prisma.settlement.findMany({
    where: { sourceTransactionId: oldTransactionId }
  });
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const newTotal = Number(data.totalPembelian || 0);

  if (newTotal < totalPaid) {
    throw new Error('New transaction total is less than existing payments. Overpayment protection activated.');
  }

  // 2. Get old transaction records to reverse
  const oldFinancialEvents = await prisma.financialEvent.findMany({
    where: { sourceTransactionId: oldTransactionId }
  });

  // 3. Create Reversal events
  for (const event of oldFinancialEvents) {
    await prisma.financialEvent.create({
      data: {
        tenantId: event.tenantId,
        sourceTransactionId: oldTransactionId,
        sourceTransactionType: 'PURCHASE_REVERSAL',
        eventType: 'REVERSAL',
        amount: -event.amount,
        occurredAt: new Date(),
        correlationId: event.correlationId,
        idempotencyKey: `idemp-${oldTransactionId}-inv-${Date.now()}`
      }
    });
  }

  // 4. Create NEW transaction records
  return await createPurchaseTransaction(data, deps);
}

module.exports = {
  normalizePurchasePayload,
  createPurchaseTransaction,
  updatePurchaseTransaction
};
