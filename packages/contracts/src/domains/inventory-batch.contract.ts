// packages/contracts/src/domains/inventory-batch.contract.ts
// InventoryContext: SKU, kategori (sediaan/pakan/benih/olahan), batch, expiry, suhu simpan
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const InventoryBatchContract = defineDomainContract({
  name: 'InventoryBatch',
  version: '1.0.0',
  cluster: 'Hilir',
  applicableBusinessTypes: [
    BusinessType.FEED_DISTRIBUTOR,
    BusinessType.SEED_DISTRIBUTOR,
    BusinessType.PROCESSED_FOOD_PRODUCER,
    BusinessType.EQUIPMENT_SUPPLIER,
  ],
  entity: {
    name: 'InventoryBatch',
    description: 'Batch stok inventaris dengan SKU, kategori, expiry date, dan suhu penyimpanan yang disyaratkan',
    backendPrismaModel: 'InventoryBatch',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'tenantId', type: 'uuid', required: true, description: 'ID tenant pemilik stok' },
      { name: 'skuCode', type: 'string', required: true, description: 'Kode SKU produk' },
      { name: 'productName', type: 'string', required: true, description: 'Nama produk' },
      { name: 'category', type: 'enum', required: true, description: 'Kategori: FEED | SEED | PROCESSED | EQUIPMENT | MEDICINE | OTHER',
        enumOptions: ['FEED','SEED','PROCESSED','EQUIPMENT','MEDICINE','OTHER'] },
      { name: 'batchNumber', type: 'string', required: false, description: 'Nomor batch produksi / lot pabrik' },
      { name: 'quantityUnits', type: 'number', required: true, unit: 'unit', description: 'Jumlah stok masuk (unit/kg/pcs)' },
      { name: 'unit', type: 'string', required: true, description: 'Satuan stok: kg, pcs, karung, liter, dll.' },
      { name: 'expiryDate', type: 'date', required: false, description: 'Tanggal kadaluarsa batch' },
      { name: 'requiredTempC', type: 'number', required: false, unit: '°C', description: 'Suhu simpan yang disyaratkan (mis. -18°C untuk produk beku)' },
      { name: 'storageLocation', type: 'string', required: false, description: 'Lokasi gudang / ruang pendingin' },
      { name: 'unitCost', type: 'number', required: false, unit: 'IDR', description: 'Harga pokok per unit' },
      { name: 'receivedAt', type: 'date', required: true, description: 'Tanggal batch diterima di gudang' },
      { name: 'supplierId', type: 'uuid', required: false, description: 'ID mitra pemasok' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan penerimaan atau kondisi batch' },
    ],
  },
  commands: [
    { name: 'ReceiveBatch', description: 'Terima batch stok baru masuk ke gudang', parameters: [
      { name: 'skuCode', type: 'string', required: true, description: 'SKU' },
      { name: 'category', type: 'string', required: true, description: 'Kategori' },
      { name: 'quantityUnits', type: 'number', required: true, description: 'Jumlah' },
      { name: 'unit', type: 'string', required: true, description: 'Satuan' },
      { name: 'batchNumber', type: 'string', required: false, description: 'Nomor batch' },
      { name: 'expiryDate', type: 'date', required: false, description: 'Tanggal kadaluarsa' },
      { name: 'requiredTempC', type: 'number', required: false, description: 'Suhu simpan (°C)' },
      { name: 'unitCost', type: 'number', required: false, description: 'Harga pokok/unit' },
      { name: 'receivedAt', type: 'date', required: true, description: 'Tanggal terima' },
    ], emitsEvent: 'BatchReceived', idempotent: true },
    { name: 'AdjustBatch', description: 'Koreksi stok batch (stok opname, rusak, hilang)', parameters: [
      { name: 'batchId', type: 'uuid', required: true, description: 'ID batch' },
      { name: 'adjustmentQty', type: 'number', required: true, description: 'Delta penyesuaian (positif atau negatif)' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan penyesuaian' },
    ], emitsEvent: 'BatchAdjusted', idempotent: true },
    { name: 'ConsumeBatch', description: 'Kurangi stok batch karena dipakai / dikirim', parameters: [
      { name: 'batchId', type: 'uuid', required: true, description: 'ID batch' },
      { name: 'quantityUsed', type: 'number', required: true, description: 'Jumlah terpakai' },
      { name: 'referenceId', type: 'uuid', required: false, description: 'ID referensi (order / siklus)' },
    ], emitsEvent: 'BatchConsumed', idempotent: true },
  ],
  events: [
    { name: 'BatchReceived', description: 'Batch stok diterima di gudang', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Batch ID' },
      { name: 'skuCode', type: 'string', required: true, description: 'SKU' },
      { name: 'quantityUnits', type: 'number', required: true, description: 'Jumlah' },
      { name: 'receivedAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'BatchAdjusted', description: 'Stok batch disesuaikan', payload: [
      { name: 'batchId', type: 'uuid', required: true, description: 'Batch ID' },
      { name: 'adjustmentQty', type: 'number', required: true, description: 'Delta' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan' },
    ], isImmutable: true },
    { name: 'BatchConsumed', description: 'Stok batch berkurang karena pemakaian', payload: [
      { name: 'batchId', type: 'uuid', required: true, description: 'Batch ID' },
      { name: 'quantityUsed', type: 'number', required: true, description: 'Jumlah terpakai' },
    ], isImmutable: true },
    { name: 'BatchExpiringSoon', description: 'Peringatan: batch akan kadaluarsa dalam 7 hari', payload: [
      { name: 'batchId', type: 'uuid', required: true, description: 'Batch ID' },
      { name: 'expiryDate', type: 'date', required: true, description: 'Tanggal kadaluarsa' },
    ], isImmutable: false },
  ],
  projections: [
    { name: 'StockLevelBySKU', target: 'InventoryStockLevel', description: 'Stok tersedia per SKU dari semua batch aktif (FIFO)', frequency: 'INSTANT' },
    { name: 'ExpiryAlertList', target: 'InventoryExpiryAlert', description: 'Daftar batch yang akan kadaluarsa ≤ 7 hari', frequency: 'DAILY' },
    { name: 'ColdChainComplianceLog', target: 'InventoryColdChainLog', description: 'Log batch yang butuh suhu khusus (-18°C) untuk produk beku', frequency: 'DAILY' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'SERVER_WINS' },
  offline: { supported: false, storageTarget: 'inventory_batches', fallbackStrategy: 'BLOCK' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
