function cloneStockState(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row) => ({
    ukuran: String(row.ukuran || '').trim(),
    stokMasuk: Number(row.stokMasuk) || Number(row.saldo) || 0,
    stokKeluar: Number(row.stokKeluar) || 0,
    stokAkhir: Number(row.stokAkhir) || Number(row.saldo) || 0,
    saldo: Number(row.stokAkhir) || Number(row.saldo) || 0
  }));
}

function ensureStockState(state) {
  return Array.isArray(state) ? state : [];
}

function findStockRow(state, ukuran) {
  const safeState = ensureStockState(state);
  return safeState.find((row) => String(row.ukuran || '').trim() === String(ukuran || '').trim());
}

function updateStockPembelian(state, ukuran, jumlah) {
  const safeState = ensureStockState(state);
  const delta = Number(jumlah) || 0;
  const target = findStockRow(safeState, ukuran);

  if (!target) {
    if (delta < 0) throw new Error(`Stok ${ukuran} tidak cukup untuk dikurangi.`);
    safeState.push({ ukuran: String(ukuran || '').trim(), stokMasuk: delta, stokKeluar: 0, stokAkhir: delta, saldo: delta });
    return;
  }

  const baseAkhir = Number(target.stokAkhir);
  const legacySaldo = Number(target.saldo);
  const masukSaatIni = Number.isFinite(Number(target.stokMasuk))
    ? Number(target.stokMasuk)
    : (Number.isFinite(baseAkhir) ? baseAkhir : (Number.isFinite(legacySaldo) ? legacySaldo : 0));
  const keluarSaatIni = Number.isFinite(Number(target.stokKeluar)) ? Number(target.stokKeluar) : 0;
  const masuk = masukSaatIni + delta;
  const keluar = keluarSaatIni;
  const akhir = masuk - keluar;

  if (masuk < 0) {
    throw new Error(`Stok masuk ${ukuran} tidak boleh negatif setelah koreksi.`);
  }

  target.stokMasuk = masuk;
  target.stokKeluar = keluar;
  target.stokAkhir = akhir;
  target.saldo = akhir;
}

function updateStockPenjualan(state, ukuran, jumlah, opsi = {}) {
  const safeState = ensureStockState(state);
  const target = findStockRow(safeState, ukuran);
  const delta = Number(jumlah) || 0;

  if (!target) {
    if (opsi.izinkanNegatif) {
      safeState.push({ ukuran: String(ukuran || '').trim(), stokMasuk: 0, stokKeluar: delta, stokAkhir: -delta, saldo: -delta });
      return;
    }
    throw new Error('Ukuran tidak ditemukan pada stok.');
  }

  const baseAkhir = Number(target.stokAkhir);
  const legacySaldo = Number(target.saldo);
  const masuk = Number.isFinite(Number(target.stokMasuk))
    ? Number(target.stokMasuk)
    : (Number.isFinite(baseAkhir) ? baseAkhir : (Number.isFinite(legacySaldo) ? legacySaldo : 0));
  const keluarSaatIni = Number.isFinite(Number(target.stokKeluar)) ? Number(target.stokKeluar) : 0;
  const keluar = keluarSaatIni + delta;
  const akhir = masuk - keluar;

  if (akhir < 0 && !opsi.izinkanNegatif) {
    throw new Error('Stok tidak mencukupi.');
  }

  target.stokMasuk = masuk;
  target.stokKeluar = keluar;
  target.stokAkhir = akhir;
  target.saldo = akhir;
}

function getStock(state, ukuran) {
  const target = findStockRow(state, ukuran);
  return target ? Number(target.stokAkhir) : 0;
}

function getAllStock(state) {
  return cloneStockState(state);
}

function adjustStock(state, data = {}) {
  const stokSistem = getStock(state, data.ukuran);
  const stokFisik = Number(data.stokFisik) || 0;
  const selisih = stokFisik - stokSistem;

  if (selisih === 0) {
    return { selisih: 0, stokBaru: stokFisik, pesan: 'Stok sistem sudah sesuai, tidak ada perubahan.' };
  }

  if (selisih > 0) {
    updateStockPembelian(state, data.ukuran, selisih);
  } else {
    updateStockPenjualan(state, data.ukuran, Math.abs(selisih));
  }

  return { selisih, stokBaru: stokFisik, pesan: 'Penyesuaian stok diterapkan.' };
}

module.exports = {
  cloneStockState,
  findStockRow,
  updateStockPembelian,
  updateStockPenjualan,
  getStock,
  getAllStock,
  adjustStock
};
