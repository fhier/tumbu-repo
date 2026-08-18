const { buildDashboardSummary, buildReportPayload } = require('./reporting');
const { createStateStore, buildSnapshot } = require('./state-store');
const { isLegacyReadOnlyEnabled } = require('./db');

const LEGACY_WRITE_ACTIONS = new Set([
  'tambahUkuran'
]);

function executeLegacyAction(actionName, args = [], context = {}) {
  const action = String(actionName || '').trim();
  if (LEGACY_WRITE_ACTIONS.has(action) && isLegacyReadOnlyEnabled()) {
    throw new Error(`Legacy write action '${action}' ditolak: legacy berada pada mode read-only.`);
  }

  const stateStore = context.stateStore || createStateStore();
  const state = stateStore.getState ? stateStore.getState() : {};
  const snapshot = buildSnapshot(state);
  const workspace = context.workspace || {};

  switch (action) {
    case 'getDashboard':
      return {
        perusahaan: {
          nama: workspace.workspaceName || 'TUMBU Demo',
          blueprintName: workspace.blueprintName || 'Distributor Benih Ikan Air Tawar',
          tagline: 'Simple Systems. Better Business.'
        },
        bulanIni: {
          pembelian: 0,
          penjualan: 0,
          pengeluaran: 0,
          laba: 0
        },
        saldoTotal: 1000,
        totalHutang: 0,
        totalPiutang: 0,
        modalBersih: 1000,
        totalStok: snapshot.stock.reduce((sum, item) => sum + Number(item.saldo || 0), 0),
        trend: [],
        pelangganTerbaik: [],
        stokDetail: snapshot.stock.map((item) => ({
          ukuran: item.ukuran,
          stokMasuk: 0,
          stokKeluar: 0,
          stokAkhir: Number(item.saldo || 0)
        })),
        alurKerjaHariIni: 'Berita Acara → Pembelian → Stok → Penjualan → Surat Jalan → Kas / Piutang',
        counts: buildDashboardSummary(snapshot).counts,
        saldoKas: buildDashboardSummary(snapshot).saldoKas,
        stockSaldo: buildDashboardSummary(snapshot).stockSaldo
      };

    case 'getMasterDataAll':
      return snapshot.masterData;

    case 'getAllStok':
      return snapshot.stock;

    case 'getKasList':
      return snapshot.cashRows;

    case 'getLaporanPeriode':
      return buildReportPayload(snapshot);

    case 'tambahUkuran':
      throw new Error("Legacy write action 'tambahUkuran' tidak didukung pada runtime cutover.");

    default:
      return { ok: true, action: actionName, args };
  }
}

module.exports = {
  executeLegacyAction
};
