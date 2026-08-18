const { Client } = require('pg');

let databaseState = {
  initialized: false,
  kind: 'memory',
  message: 'No PostgreSQL connection configured.'
};

let client = null;
const WORKSPACE_SETTINGS_MEMORY = {};
const WORKSPACE_REGISTRY_MEMORY = [];
let MASTER_DATA_MEMORY = null;
const PURCHASE_TRANSACTIONS_MEMORY = [];
const SALE_TRANSACTIONS_MEMORY = [];
let STOCK_MEMORY = null;
const CASH_MUTATIONS_MEMORY = [];
const REPORT_SNAPSHOTS_MEMORY = [];
const LEGACY_READ_ONLY_DEFAULT = String(process.env.LEGACY_READ_ONLY_MODE || 'true').trim().toLowerCase() !== 'false';
const LEGACY_READONLY_MEMORY = {
  prepared: LEGACY_READ_ONLY_DEFAULT,
  preparedAt: '',
  note: ''
};

function normalizeMasterData(payload = {}) {
  const supplier = Array.isArray(payload.supplier) ? payload.supplier : [];
  const pelanggan = Array.isArray(payload.pelanggan) ? payload.pelanggan : [];
  const ukuran = Array.isArray(payload.ukuran) ? payload.ukuran : [];
  return {
    supplier: supplier.map((entry) => ({
      kode: String(entry.kode || ''),
      nama: String(entry.nama || ''),
      alamat: String(entry.alamat || ''),
      hp: String(entry.hp || ''),
      status: String(entry.status || 'Aktif')
    })),
    pelanggan: pelanggan.map((entry) => ({
      kode: String(entry.kode || ''),
      nama: String(entry.nama || ''),
      alamat: String(entry.alamat || ''),
      hp: String(entry.hp || ''),
      status: String(entry.status || 'Aktif')
    })),
    ukuran: ukuran.map((entry) => String(entry || '')).filter(Boolean)
  };
}

function normalizeStockRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row) => ({
    ukuran: String(row.ukuran || '').trim(),
    stokMasuk: Number(row.stokMasuk) || Number(row.saldo) || 0,
    stokKeluar: Number(row.stokKeluar) || 0,
    stokAkhir: Number(row.stokAkhir) || Number(row.saldo) || 0,
    saldo: Number(row.stokAkhir) || Number(row.saldo) || 0
  }));
}

function replaceWorkspaceSettingsMemory(nextSettings) {
  Object.keys(WORKSPACE_SETTINGS_MEMORY).forEach((key) => delete WORKSPACE_SETTINGS_MEMORY[key]);
  Object.entries(nextSettings || {}).forEach(([key, value]) => {
    WORKSPACE_SETTINGS_MEMORY[key] = String(value || '');
  });
}

function replaceWorkspaceRegistryMemory(nextRegistry) {
  WORKSPACE_REGISTRY_MEMORY.length = 0;
  (nextRegistry || []).forEach((row) => {
    WORKSPACE_REGISTRY_MEMORY.push(Object.assign({}, row));
  });
}

async function hydrateWorkspacePersistence() {
  if (!client) return;

  const settingsRows = await client.query(`
    SELECT setting_key, setting_value
    FROM tumbu_workspace_settings
  `);
  const nextSettings = {};
  settingsRows.rows.forEach((row) => {
    nextSettings[row.setting_key] = String(row.setting_value || '');
  });
  replaceWorkspaceSettingsMemory(nextSettings);

  const registryRows = await client.query(`
    SELECT
      workspace_id,
      workspace_name,
      owner,
      industry_category,
      blueprint_id,
      enabled_modules,
      template_id,
      template_version,
      spreadsheet_id,
      web_app_url,
      engine_version,
      ai_context,
      status,
      legacy_mixed,
      dibuat,
      diperbarui
    FROM tumbu_workspace_registry
    ORDER BY diperbarui DESC, workspace_id ASC
  `);

  replaceWorkspaceRegistryMemory(registryRows.rows.map((row) => ({
    workspaceId: String(row.workspace_id || ''),
    workspaceName: String(row.workspace_name || ''),
    owner: String(row.owner || ''),
    industryCategory: String(row.industry_category || ''),
    blueprintId: String(row.blueprint_id || ''),
    enabledModules: String(row.enabled_modules || ''),
    templateId: String(row.template_id || ''),
    templateVersion: String(row.template_version || ''),
    spreadsheetId: String(row.spreadsheet_id || ''),
    webAppUrl: String(row.web_app_url || ''),
    engineVersion: String(row.engine_version || ''),
    aiContext: String(row.ai_context || ''),
    status: String(row.status || 'active'),
    legacyMixed: String(row.legacy_mixed || 'Tidak'),
    dibuat: row.dibuat ? new Date(row.dibuat).toISOString() : '',
    diperbarui: row.diperbarui ? new Date(row.diperbarui).toISOString() : ''
  })));
}

async function hydrateMasterDataPersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_master_data
    WHERE id = 1
  `);

  if (!rows.rows.length) {
    MASTER_DATA_MEMORY = null;
    return;
  }

  MASTER_DATA_MEMORY = normalizeMasterData(rows.rows[0].payload || {});
}

async function hydratePurchasePersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_purchase_transactions
    ORDER BY id ASC
  `);

  PURCHASE_TRANSACTIONS_MEMORY.length = 0;
  rows.rows.forEach((row) => {
    PURCHASE_TRANSACTIONS_MEMORY.push(Object.assign({}, row.payload || {}));
  });
}

async function hydrateSalePersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_sale_transactions
    ORDER BY id ASC
  `);

  SALE_TRANSACTIONS_MEMORY.length = 0;
  rows.rows.forEach((row) => {
    SALE_TRANSACTIONS_MEMORY.push(Object.assign({}, row.payload || {}));
  });
}

async function hydrateStockPersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_stock_state
    WHERE id = 1
  `);

  if (!rows.rows.length) {
    STOCK_MEMORY = null;
    return;
  }

  STOCK_MEMORY = normalizeStockRows(rows.rows[0].payload || []);
}

async function hydrateCashPersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_cash_mutations
    ORDER BY id ASC
  `);

  CASH_MUTATIONS_MEMORY.length = 0;
  rows.rows.forEach((row) => {
    CASH_MUTATIONS_MEMORY.push(Object.assign({}, row.payload || {}));
  });
}

async function hydrateReportingPersistence() {
  if (!client) return;

  const rows = await client.query(`
    SELECT payload
    FROM tumbu_reporting_snapshots
    ORDER BY id ASC
  `);

  REPORT_SNAPSHOTS_MEMORY.length = 0;
  rows.rows.forEach((row) => {
    REPORT_SNAPSHOTS_MEMORY.push(Object.assign({}, row.payload || {}));
  });
}

async function hydrateLegacyReadOnlyPreparation() {
  if (!client) return;

  const rows = await client.query(`
    SELECT prepared, prepared_at, note
    FROM tumbu_legacy_readonly_preparation
    WHERE id = 1
  `);

  if (!rows.rows.length) return;
  const row = rows.rows[0];
  LEGACY_READONLY_MEMORY.prepared = Boolean(row.prepared);
  LEGACY_READONLY_MEMORY.preparedAt = row.prepared_at ? new Date(row.prepared_at).toISOString() : '';
  LEGACY_READONLY_MEMORY.note = String(row.note || '');
}

async function persistWorkspaceSetting(key, value) {
  if (!client || databaseState.kind !== 'postgres') return;

  await client.query(
    `
      INSERT INTO tumbu_workspace_settings (setting_key, setting_value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value
    `,
    [key, value]
  );
}

async function persistWorkspaceRegistry(row) {
  if (!client || databaseState.kind !== 'postgres') return;

  await client.query(
    `
      INSERT INTO tumbu_workspace_registry (
        workspace_id,
        workspace_name,
        owner,
        industry_category,
        blueprint_id,
        enabled_modules,
        template_id,
        template_version,
        spreadsheet_id,
        web_app_url,
        engine_version,
        ai_context,
        status,
        legacy_mixed,
        dibuat,
        diperbarui
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (workspace_id)
      DO UPDATE SET
        workspace_name = EXCLUDED.workspace_name,
        owner = EXCLUDED.owner,
        industry_category = EXCLUDED.industry_category,
        blueprint_id = EXCLUDED.blueprint_id,
        enabled_modules = EXCLUDED.enabled_modules,
        template_id = EXCLUDED.template_id,
        template_version = EXCLUDED.template_version,
        spreadsheet_id = EXCLUDED.spreadsheet_id,
        web_app_url = EXCLUDED.web_app_url,
        engine_version = EXCLUDED.engine_version,
        ai_context = EXCLUDED.ai_context,
        status = EXCLUDED.status,
        legacy_mixed = EXCLUDED.legacy_mixed,
        dibuat = EXCLUDED.dibuat,
        diperbarui = EXCLUDED.diperbarui
    `,
    [
      row.workspaceId,
      row.workspaceName,
      row.owner,
      row.industryCategory,
      row.blueprintId,
      row.enabledModules,
      row.templateId,
      row.templateVersion,
      row.spreadsheetId,
      row.webAppUrl,
      row.engineVersion,
      row.aiContext,
      row.status,
      row.legacyMixed,
      row.dibuat,
      row.diperbarui
    ]
  );
}

async function persistMasterData(payload) {
  if (!client || databaseState.kind !== 'postgres') return;

  await client.query(
    `
      INSERT INTO tumbu_master_data (id, payload)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload
    `,
    [JSON.stringify(normalizeMasterData(payload))]
  );
}

async function persistPurchaseTransaction(entry) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_purchase_transactions (payload)
      VALUES ($1::jsonb)
    `,
    [JSON.stringify(entry || {})]
  );
}

async function persistSaleTransaction(entry) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_sale_transactions (payload)
      VALUES ($1::jsonb)
    `,
    [JSON.stringify(entry || {})]
  );
}

async function persistStock(payload) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_stock_state (id, payload)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload
    `,
    [JSON.stringify(normalizeStockRows(payload))]
  );
}

async function persistCashMutation(entry) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_cash_mutations (payload)
      VALUES ($1::jsonb)
    `,
    [JSON.stringify(entry || {})]
  );
}

async function persistReportSnapshot(entry) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_reporting_snapshots (payload)
      VALUES ($1::jsonb)
    `,
    [JSON.stringify(entry || {})]
  );
}

async function persistLegacyReadOnlyPreparation(entry) {
  if (!client || databaseState.kind !== 'postgres') return;
  await client.query(
    `
      INSERT INTO tumbu_legacy_readonly_preparation (id, prepared, prepared_at, note)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        prepared = EXCLUDED.prepared,
        prepared_at = EXCLUDED.prepared_at,
        note = EXCLUDED.note
    `,
    [Boolean(entry.prepared), entry.preparedAt || null, String(entry.note || '')]
  );
}

async function runPersistenceTransaction(work) {
  if (!client || databaseState.kind !== 'postgres') return;

  await client.query('BEGIN');
  try {
    await work();
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.warn(`[db] Failed to rollback transaction: ${rollbackError.message}`);
    }
    throw error;
  }
}

function persistPurchaseStockCashFlow(payload = {}) {
  const entry = Object.assign({}, payload.transactionEntry || {});
  const stockSnapshot = normalizeStockRows(payload.stockSnapshot || []);
  const cashMutation = payload.cashMutation ? Object.assign({}, payload.cashMutation) : null;

  PURCHASE_TRANSACTIONS_MEMORY.push(entry);
  STOCK_MEMORY = stockSnapshot;
  if (cashMutation) {
    CASH_MUTATIONS_MEMORY.push(cashMutation);
  }

  runPersistenceTransaction(async () => {
    await persistPurchaseTransaction(entry);
    await persistStock(stockSnapshot);
    if (cashMutation) {
      await persistCashMutation(cashMutation);
    }
  }).catch((error) => {
    console.warn(`[db] Failed to persist purchase-stock-cash flow: ${error.message}`);
  });
}

function persistSaleStockCashFlow(payload = {}) {
  const entry = Object.assign({}, payload.transactionEntry || {});
  const stockSnapshot = normalizeStockRows(payload.stockSnapshot || []);
  const cashMutation = payload.cashMutation ? Object.assign({}, payload.cashMutation) : null;

  SALE_TRANSACTIONS_MEMORY.push(entry);
  STOCK_MEMORY = stockSnapshot;
  if (cashMutation) {
    CASH_MUTATIONS_MEMORY.push(cashMutation);
  }

  runPersistenceTransaction(async () => {
    await persistSaleTransaction(entry);
    await persistStock(stockSnapshot);
    if (cashMutation) {
      await persistCashMutation(cashMutation);
    }
  }).catch((error) => {
    console.warn(`[db] Failed to persist sale-stock-cash flow: ${error.message}`);
  });
}

async function initializeDatabase() {
  if (databaseState.initialized) {
    return databaseState;
  }

  const connectionString = process.env.DATABASE_URL || '';
  if (!connectionString) {
    databaseState = {
      initialized: true,
      kind: 'memory',
      message: 'No PostgreSQL connection configured. Using in-memory store.'
    };
    return databaseState;
  }

  try {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Admin'
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_workspaces (
        id SERIAL PRIMARY KEY,
        workspace_id TEXT UNIQUE NOT NULL,
        workspace_name TEXT NOT NULL,
        blueprint_id TEXT NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_transactions (
        id SERIAL PRIMARY KEY,
        transaction_type TEXT NOT NULL,
        transaction_no TEXT NOT NULL,
        payload JSONB NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_workspace_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL DEFAULT ''
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_workspace_registry (
        workspace_id TEXT PRIMARY KEY,
        workspace_name TEXT NOT NULL DEFAULT '',
        owner TEXT NOT NULL DEFAULT '',
        industry_category TEXT NOT NULL DEFAULT '',
        blueprint_id TEXT NOT NULL DEFAULT '',
        enabled_modules TEXT NOT NULL DEFAULT '',
        template_id TEXT NOT NULL DEFAULT '',
        template_version TEXT NOT NULL DEFAULT '',
        spreadsheet_id TEXT NOT NULL DEFAULT '',
        web_app_url TEXT NOT NULL DEFAULT '',
        engine_version TEXT NOT NULL DEFAULT '',
        ai_context TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        legacy_mixed TEXT NOT NULL DEFAULT 'Tidak',
        dibuat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        diperbarui TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_master_data (
        id SMALLINT PRIMARY KEY,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_purchase_transactions (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_sale_transactions (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_stock_state (
        id SMALLINT PRIMARY KEY,
        payload JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_cash_mutations (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_reporting_snapshots (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumbu_legacy_readonly_preparation (
        id SMALLINT PRIMARY KEY,
        prepared BOOLEAN NOT NULL DEFAULT FALSE,
        prepared_at TIMESTAMPTZ NULL,
        note TEXT NOT NULL DEFAULT ''
      )
    `);
    databaseState = {
      initialized: true,
      kind: 'postgres',
      message: 'Connected to PostgreSQL.'
    };
    await hydrateWorkspacePersistence();
    await hydrateMasterDataPersistence();
    await hydratePurchasePersistence();
    await hydrateSalePersistence();
    await hydrateStockPersistence();
    await hydrateCashPersistence();
    await hydrateReportingPersistence();
    await hydrateLegacyReadOnlyPreparation();
  } catch (error) {
    console.warn(`[db] PostgreSQL unavailable: ${error.message}`);
    databaseState = {
      initialized: true,
      kind: 'memory',
      message: `PostgreSQL unavailable: ${error.message}`
    };
  }

  return databaseState;
}

function getDatabaseHealth() {
  return {
    initialized: databaseState.initialized,
    kind: databaseState.kind,
    message: databaseState.message
  };
}

function readWorkspaceSetting(key, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(WORKSPACE_SETTINGS_MEMORY, key)) {
    return WORKSPACE_SETTINGS_MEMORY[key];
  }
  return fallback;
}

function writeWorkspaceSetting(key, value) {
  const normalized = String(value || '');
  WORKSPACE_SETTINGS_MEMORY[key] = normalized;
  persistWorkspaceSetting(key, normalized).catch((error) => {
    console.warn(`[db] Failed to persist workspace setting "${key}": ${error.message}`);
  });
}

function getWorkspaceSettingsSnapshot() {
  return Object.assign({}, WORKSPACE_SETTINGS_MEMORY);
}

function upsertWorkspaceRegistryRow(row) {
  const idx = WORKSPACE_REGISTRY_MEMORY.findIndex((item) => item.workspaceId === row.workspaceId);
  const record = Object.assign({}, row);
  if (idx === -1) {
    WORKSPACE_REGISTRY_MEMORY.push(record);
  } else {
    WORKSPACE_REGISTRY_MEMORY[idx] = record;
  }

  persistWorkspaceRegistry(record).catch((error) => {
    console.warn(`[db] Failed to persist workspace registry "${record.workspaceId}": ${error.message}`);
  });
}

function getWorkspaceRegistrySnapshot() {
  return WORKSPACE_REGISTRY_MEMORY.map((item) => Object.assign({}, item));
}

function resetWorkspaceStorage() {
  replaceWorkspaceSettingsMemory({});
  replaceWorkspaceRegistryMemory([]);
}

function getMasterDataSnapshot(fallback = {}) {
  if (MASTER_DATA_MEMORY) {
    return normalizeMasterData(MASTER_DATA_MEMORY);
  }
  return normalizeMasterData(fallback);
}

function writeMasterDataSnapshot(payload = {}) {
  MASTER_DATA_MEMORY = normalizeMasterData(payload);
  persistMasterData(MASTER_DATA_MEMORY).catch((error) => {
    console.warn(`[db] Failed to persist master data: ${error.message}`);
  });
}

function resetMasterDataStorage() {
  MASTER_DATA_MEMORY = null;
}

function getPurchaseTransactionsSnapshot() {
  return PURCHASE_TRANSACTIONS_MEMORY.map((entry) => Object.assign({}, entry));
}

function resetPurchaseStorage() {
  PURCHASE_TRANSACTIONS_MEMORY.length = 0;
}

function getSaleTransactionsSnapshot() {
  return SALE_TRANSACTIONS_MEMORY.map((entry) => Object.assign({}, entry));
}

function resetSaleStorage() {
  SALE_TRANSACTIONS_MEMORY.length = 0;
}

function getStockSnapshot(fallback = []) {
  if (STOCK_MEMORY) {
    return normalizeStockRows(STOCK_MEMORY);
  }
  return normalizeStockRows(fallback);
}

function writeStockSnapshot(payload = []) {
  STOCK_MEMORY = normalizeStockRows(payload);
  persistStock(STOCK_MEMORY).catch((error) => {
    console.warn(`[db] Failed to persist stock state: ${error.message}`);
  });
}

function resetStockStorage() {
  STOCK_MEMORY = null;
}

function getCashMutationsSnapshot() {
  return CASH_MUTATIONS_MEMORY.map((entry) => Object.assign({}, entry));
}

function resetCashStorage() {
  CASH_MUTATIONS_MEMORY.length = 0;
}

function appendReportSnapshot(entry = {}) {
  const record = Object.assign({}, entry);
  REPORT_SNAPSHOTS_MEMORY.push(record);
  persistReportSnapshot(record).catch((error) => {
    console.warn(`[db] Failed to persist report snapshot: ${error.message}`);
  });
}

function getReportSnapshots() {
  return REPORT_SNAPSHOTS_MEMORY.map((entry) => Object.assign({}, entry));
}

function resetReportingStorage() {
  REPORT_SNAPSHOTS_MEMORY.length = 0;
}

function getLegacyReadOnlyPreparationStatus() {
  return Object.assign({}, LEGACY_READONLY_MEMORY);
}

function isLegacyReadOnlyEnabled() {
  return Boolean(LEGACY_READONLY_MEMORY.prepared);
}

function markLegacyReadOnlyPrepared(note = '') {
  const preparedAt = new Date().toISOString();
  LEGACY_READONLY_MEMORY.prepared = true;
  LEGACY_READONLY_MEMORY.preparedAt = preparedAt;
  LEGACY_READONLY_MEMORY.note = String(note || '');
  persistLegacyReadOnlyPreparation(LEGACY_READONLY_MEMORY).catch((error) => {
    console.warn(`[db] Failed to persist legacy read-only preparation: ${error.message}`);
  });
}

function resetLegacyReadOnlyPreparation() {
  LEGACY_READONLY_MEMORY.prepared = false;
  LEGACY_READONLY_MEMORY.preparedAt = '';
  LEGACY_READONLY_MEMORY.note = '';
}

module.exports = {
  initializeDatabase,
  getDatabaseHealth,
  readWorkspaceSetting,
  writeWorkspaceSetting,
  getWorkspaceSettingsSnapshot,
  upsertWorkspaceRegistryRow,
  getWorkspaceRegistrySnapshot,
  resetWorkspaceStorage,
  getMasterDataSnapshot,
  writeMasterDataSnapshot,
  resetMasterDataStorage,
  persistPurchaseStockCashFlow,
  getPurchaseTransactionsSnapshot,
  resetPurchaseStorage,
  persistSaleStockCashFlow,
  getSaleTransactionsSnapshot,
  resetSaleStorage,
  getStockSnapshot,
  writeStockSnapshot,
  resetStockStorage,
  getCashMutationsSnapshot,
  resetCashStorage,
  appendReportSnapshot,
  getReportSnapshots,
  resetReportingStorage,
  isLegacyReadOnlyEnabled,
  getLegacyReadOnlyPreparationStatus,
  markLegacyReadOnlyPrepared,
  resetLegacyReadOnlyPreparation
};
