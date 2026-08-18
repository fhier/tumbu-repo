// packages/contracts/src/domains/order-transaction.contract.ts
// Supply Chain: transaksi jual-beli, multi-termin, status order
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const OrderTransactionContract = defineDomainContract({
  name: 'OrderTransaction',
  version: '1.0.0',
  cluster: 'Hilir',
  applicableBusinessTypes: [
    BusinessType.FEED_DISTRIBUTOR,
    BusinessType.SEED_DISTRIBUTOR,
    BusinessType.HARVEST_OFFTAKER,
    BusinessType.PROCESSED_FOOD_PRODUCER,
    BusinessType.LOGISTICS_TRANSPORTER,
    BusinessType.EQUIPMENT_SUPPLIER,
  ],
  entity: {
    name: 'OrderTransaction',
    description: 'Transaksi jual-beli di rantai pasok TUMBU — mendukung multi-termin pembayaran dan tracking status order',
    backendPrismaModel: 'Transaction',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'tenantId', type: 'uuid', required: true, description: 'ID tenant pemilik transaksi' },
      { name: 'number', type: 'string', required: true, description: 'Nomor order / nota unik' },
      { name: 'type', type: 'enum', required: true, description: 'Jenis transaksi', enumOptions: ['SALE','PURCHASE','RETURN_SALE','RETURN_PURCHASE'] },
      { name: 'date', type: 'date', required: true, description: 'Tanggal transaksi' },
      { name: 'partnerId', type: 'uuid', required: false, description: 'ID mitra (pelanggan / pemasok)' },
      { name: 'partner', type: 'string', required: true, description: 'Nama mitra (denormalized)' },
      { name: 'total', type: 'number', required: true, unit: 'IDR', description: 'Total nilai transaksi' },
      { name: 'paidAmount', type: 'number', required: true, unit: 'IDR', description: 'Total yang sudah dibayarkan' },
      { name: 'status', type: 'enum', required: true, description: 'Status pembayaran', enumOptions: ['UNPAID','PARTIAL','PAID','OVERDUE','CANCELLED'] },
      { name: 'account', type: 'enum', required: true, description: 'Metode pembayaran', enumOptions: ['CASH','TRANSFER','CREDIT','COD'] },
      { name: 'discountAmount', type: 'number', required: false, unit: 'IDR', description: 'Diskon total transaksi' },
      { name: 'feeAmount', type: 'number', required: false, unit: 'IDR', description: 'Biaya tambahan (kirim, bongkar, dll.)' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan transaksi' },
    ],
  },
  commands: [
    { name: 'CreateOrder', description: 'Buat order / transaksi baru', parameters: [
      { name: 'type', type: 'string', required: true, description: 'SALE | PURCHASE | ...' },
      { name: 'partner', type: 'string', required: true, description: 'Nama mitra' },
      { name: 'date', type: 'date', required: true, description: 'Tanggal' },
      { name: 'items', type: 'json', required: true, description: 'Line items: [{skuCode, qty, price}]' },
      { name: 'account', type: 'string', required: true, description: 'Metode bayar' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'OrderCreated', idempotent: true },
    { name: 'RecordPayment', description: 'Catat pembayaran termin (partial / full)', parameters: [
      { name: 'transactionId', type: 'uuid', required: true, description: 'ID transaksi' },
      { name: 'amount', type: 'number', required: true, description: 'Nilai pembayaran (IDR)' },
      { name: 'paidAt', type: 'date', required: true, description: 'Tanggal bayar' },
      { name: 'account', type: 'string', required: true, description: 'Metode bayar' },
    ], emitsEvent: 'PaymentRecorded', idempotent: true },
    { name: 'CancelOrder', description: 'Batalkan order yang belum selesai', parameters: [
      { name: 'transactionId', type: 'uuid', required: true, description: 'ID transaksi' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan pembatalan' },
    ], emitsEvent: 'OrderCancelled', idempotent: true },
  ],
  events: [
    { name: 'OrderCreated', description: 'Order baru dibuat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Transaction ID' },
      { name: 'number', type: 'string', required: true, description: 'Nomor order' },
      { name: 'total', type: 'number', required: true, description: 'Total (IDR)' },
      { name: 'date', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'PaymentRecorded', description: 'Pembayaran termin dicatat', payload: [
      { name: 'transactionId', type: 'uuid', required: true, description: 'Transaction ID' },
      { name: 'amount', type: 'number', required: true, description: 'Nilai bayar (IDR)' },
      { name: 'newStatus', type: 'string', required: true, description: 'Status baru: PARTIAL | PAID' },
    ], isImmutable: true },
    { name: 'OrderCancelled', description: 'Order dibatalkan', payload: [
      { name: 'transactionId', type: 'uuid', required: true, description: 'Transaction ID' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'ARAgingReport', target: 'AccountsReceivableAging', description: 'Laporan piutang jatuh tempo per mitra dengan aging bucket 0-30-60-90 hari', frequency: 'DAILY' },
    { name: 'SalesTrend', target: 'SalesTrendSummary', description: 'Ringkasan omzet penjualan per periode untuk cashflow forecast', frequency: 'DAILY' },
    { name: 'OrderFulfillmentStatus', target: 'OrderFulfillmentTracker', description: 'Tracking status order dari dibuat hingga lunas', frequency: 'INSTANT' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'SERVER_WINS' },
  offline: { supported: false, storageTarget: 'transactions', fallbackStrategy: 'BLOCK' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
