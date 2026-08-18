const { addSupplier, addPelanggan, addUkuran, buildMasterDataState } = require('./modules/master-data/service');
const { createPurchaseTransaction } = require('./modules/purchase/service');
const { createSaleTransaction } = require('./modules/sale/service');
const { updateStockPembelian, updateStockPenjualan } = require('./modules/stock/service');
const { createCashMutation } = require('./modules/cash/service');
const {
  getMasterDataSnapshot,
  writeMasterDataSnapshot,
  persistPurchaseStockCashFlow,
  persistSaleStockCashFlow,
  getStockSnapshot
} = require('./db');

function createStateStore(initialState = {}) {
  const state = {
    masterData: buildMasterDataState(getMasterDataSnapshot(initialState.masterData || {})),
    stock: getStockSnapshot(initialState.stock || []),
    cashRows: Array.isArray(initialState.cashRows) ? initialState.cashRows : [],
    transactions: Array.isArray(initialState.transactions) ? initialState.transactions : [],
    ...initialState
  };

  return {
    getState() {
      return state;
    },
    addSupplier(data = {}) {
      const code = addSupplier(state.masterData, data);
      writeMasterDataSnapshot(state.masterData);
      return { code, state: state.masterData };
    },
    addPelanggan(data = {}) {
      const code = addPelanggan(state.masterData, data);
      writeMasterDataSnapshot(state.masterData);
      return { code, state: state.masterData };
    },
    addUkuran(name) {
      const added = addUkuran(state.masterData, name);
      writeMasterDataSnapshot(state.masterData);
      return { added, state: state.masterData };
    },
    addTransaction(entry = {}) {
      state.transactions.push(entry);
      return entry;
    },
    async createPurchase(data = {}) {
      const result = await createPurchaseTransaction(data, {
        stockState: state.stock,
        stockService: { updateStockPembelian },
        cashService: { createCashMutation }
      });
      const entry = { type: 'purchase', ...result };
      state.transactions.push(entry);
      persistPurchaseStockCashFlow({
        transactionEntry: entry,
        stockSnapshot: state.stock,
        cashMutation: result.cashMutation || null
      });
      return result;
    },
    async createSale(data = {}) {
      const result = await createSaleTransaction(data, {
        stockState: state.stock,
        stockService: { updateStockPenjualan },
        cashService: { createCashMutation }
      });
      const entry = { type: 'sale', ...result };
      state.transactions.push(entry);
      persistSaleStockCashFlow({
        transactionEntry: entry,
        stockSnapshot: state.stock,
        cashMutation: result.cashMutation || null
      });
      return result;
    }
  };
}

function buildSnapshot(state = {}) {
  return {
    masterData: state.masterData || buildMasterDataState({}),
    stock: state.stock || [],
    cashRows: state.cashRows || [],
    transactions: state.transactions || []
  };
}

module.exports = {
  createStateStore,
  buildSnapshot
};
