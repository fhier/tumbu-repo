function normalizeSalePayload(data = {}) {
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

  const totalPenjualan = normalizedItems.reduce((sum, item) => sum + item.totalEkor * item.hargaEkor, 0);
  const totalPotongan = Number(data.totalPotongan) || 0;
  const nominalTagihan = Math.max(totalPenjualan - totalPotongan, 0);
  const diterimaSekarang = Number(data.diterimaSekarang) || 0;
  const sisaPiutang = Math.max(nominalTagihan - diterimaSekarang, 0);

  return {
    tanggal: String(data.tanggal || '').trim(),
    pelanggan: String(data.pelanggan || '').trim(),
    pelangganHp: String(data.pelangganHp || '').trim(),
    pelangganAlamat: String(data.pelangganAlamat || '').trim(),
    items,
    itemsSiap: normalizedItems,
    totalPenjualan,
    totalPotongan,
    nominalTagihan,
    diterimaSekarang,
    sisaPiutang,
    jumlahUkuran: normalizedItems.length,
    totalEkorKeseluruhan: normalizedItems.reduce((sum, item) => sum + item.totalEkor, 0),
    keterangan: String(data.keterangan || '').trim()
  };
}

const { prisma } = require('../../prisma-singleton');

async function createSaleTransaction(data = {}, deps = {}) {
  const siap = normalizeSalePayload(data);
  const noTransaksi = String(data.noTransaksi || `PJ${Date.now()}`).trim();
  const stockState = Array.isArray(deps.stockState) ? deps.stockState : [];
  const correlationId = `corr-${Date.now()}-${noTransaksi}`;

  const result = {
    noTransaksi,
    totalEkor: siap.totalEkorKeseluruhan,
    totalPenjualan: siap.totalPenjualan,
    totalPotongan: siap.totalPotongan,
    nominalTagihan: siap.nominalTagihan,
    sisaPiutang: siap.sisaPiutang,
    jumlahUkuran: siap.jumlahUkuran,
    payload: siap
  };

  // Financial Persistence
  await prisma.financialEvent.create({
    data: {
      tenantId: data.tenantId || 'default',
      sourceTransactionId: noTransaksi,
      sourceTransactionType: 'SALE',
      eventType: 'REVENUE_RECOGNITION',
      amount: siap.nominalTagihan,
      occurredAt: new Date(),
      correlationId,
      idempotencyKey: `idemp-${noTransaksi}-rev`
    }
  });

  if (siap.diterimaSekarang > 0) {
    await prisma.settlement.create({
      data: {
        tenantId: data.tenantId || 'default',
        sourceTransactionId: noTransaksi,
        amount: siap.diterimaSekarang,
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
          { accountId: 'CASH', debit: siap.diterimaSekarang, credit: 0 },
          { accountId: 'RECEIVABLE', debit: siap.sisaPiutang, credit: 0 },
          { accountId: 'REVENUE', debit: 0, credit: siap.nominalTagihan }
        ]
      }
    }
  });

  if (deps.stockService && typeof deps.stockService.updateStockPenjualan === 'function') {
    for (const item of siap.itemsSiap) {
      deps.stockService.updateStockPenjualan(stockState, item.ukuran, item.totalEkor, { izinkanNegatif: false });
    }
  }

  if (deps.cashService && typeof deps.cashService.createCashMutation === 'function' && siap.diterimaSekarang > 0) {
    result.cashMutation = await deps.cashService.createCashMutation({
      tanggal: siap.tanggal,
      tipe: 'Masuk',
      kategori: 'Penjualan',
      referensi: noTransaksi,
      nominal: siap.diterimaSekarang,
      keterangan: `Penerimaan penjualan ${siap.pelanggan} (${noTransaksi})`
    });
  }

  if (deps.debtService && typeof deps.debtService.createDebtEntry === 'function' && siap.sisaPiutang > 0) {
    result.debtEntry = deps.debtService.createDebtEntry({
      noTransaksi,
      tanggal: siap.tanggal,
      pelanggan: siap.pelanggan,
      totalPiutang: siap.nominalTagihan,
      totalDibayar: siap.diterimaSekarang,
      sisaPiutang: siap.sisaPiutang
    });
  }

  return result;
}

async function updateSaleTransaction(oldTransactionId, data = {}, deps = {}) {
  // 1. Check existing payments
  const payments = await prisma.settlement.findMany({
    where: { sourceTransactionId: oldTransactionId }
  });
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const newTotal = Number(data.totalPenjualan || 0);

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
        sourceTransactionType: 'SALE_REVERSAL',
        eventType: 'REVERSAL',
        amount: -event.amount,
        occurredAt: new Date(),
        correlationId: event.correlationId,
        idempotencyKey: `idemp-${oldTransactionId}-rev-${Date.now()}`
      }
    });
  }

  // 4. Create NEW transaction records (as per createSaleTransaction)
  return await createSaleTransaction(data, deps);
}

module.exports = {
  normalizeSalePayload,
  createSaleTransaction,
  updateSaleTransaction
};
