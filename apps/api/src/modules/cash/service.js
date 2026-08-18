const { prisma } = require('../../prisma-singleton');

async function createCashMutation({ tenantId, tanggal, tipe, kategori, referensi, nominal, keterangan, saldoAwalKas = 0 }) {
  const safeNominal = Number(nominal) || 0;
  const saldoSebelumnya = saldoAwalKas;
  const saldoBaru = tipe === 'Masuk' ? saldoSebelumnya + safeNominal : saldoSebelumnya - safeNominal;
  const correlationId = `corr-${Date.now()}-${referensi}`;

  // Persist Settlement if it relates to a transaction
  if (referensi && kategori !== 'SaldoAwal') {
    await prisma.settlement.create({
      data: {
        tenantId: tenantId || 'default',
        sourceTransactionId: referensi,
        amount: safeNominal,
        idempotencyKey: `idemp-${referensi}-${Date.now()}`
      }
    });
  }

  return {
    noTransaksi: `KAS${Date.now()}`,
    tanggal: tanggal || '',
    tipe,
    kategori,
    referensi: referensi || '',
    nominal: safeNominal,
    keterangan: keterangan || '',
    saldo: saldoBaru
  };
}

function buildCashSummary(rows = [], saldoAwalKas = 0) {
  const totalMasuk = rows.filter((row) => row.tipe === 'Masuk').reduce((sum, row) => sum + Number(row.nominal || 0), 0);
  const totalKeluar = rows.filter((row) => row.tipe === 'Keluar').reduce((sum, row) => sum + Number(row.nominal || 0), 0);
  let saldo = Number(saldoAwalKas || 0);

  for (const row of rows) {
    saldo = row.tipe === 'Masuk' ? saldo + Number(row.nominal || 0) : saldo - Number(row.nominal || 0);
  }

  return {
    saldo,
    totalMasuk,
    totalKeluar
  };
}

function rebuildCashSaldo(rows = [], saldoAwalKas = 0) {
  let saldo = Number(saldoAwalKas || 0);
  return rows.map((row) => {
    saldo = row.tipe === 'Masuk' ? saldo + Number(row.nominal || 0) : saldo - Number(row.nominal || 0);
    return { ...row, saldo };
  });
}

module.exports = {
  createCashMutation,
  buildCashSummary,
  rebuildCashSaldo
};
