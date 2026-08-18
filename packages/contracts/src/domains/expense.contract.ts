// packages/contracts/src/domains/expense.contract.ts
// Finance/BOP: pengeluaran operasional kolam & gudang
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const ExpenseContract = defineDomainContract({
  name: 'AquaExpenseEvent',
  version: '1.0.0',
  cluster: 'Inti',
  applicableBusinessTypes: [
    BusinessType.CULTIVATOR,
    BusinessType.FEED_DISTRIBUTOR,
    BusinessType.SEED_DISTRIBUTOR,
    BusinessType.PROCESSED_FOOD_PRODUCER,
  ],
  entity: {
    name: 'AquaExpenseEvent',
    description: 'Pengeluaran operasional untuk menghitung Biaya Operasional Pokok (BOP) per siklus atau per gudang',
    backendPrismaModel: 'AquaExpenseEvent',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'tenantId', type: 'uuid', required: true, description: 'ID tenant' },
      { name: 'cycleId', type: 'uuid', required: false, description: 'ID siklus budidaya (opsional, bisa pengeluaran gudang)' },
      { name: 'categoryId', type: 'uuid', required: true, description: 'ID kategori BOP (AquaCostCategory)' },
      { name: 'amount', type: 'number', required: true, unit: 'IDR', description: 'Nilai pengeluaran (IDR)', validationRule: 'amount > 0' },
      { name: 'description', type: 'string', required: true, description: 'Deskripsi pengeluaran' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal pengeluaran terjadi' },
      { name: 'source', type: 'enum', required: false, description: 'Sumber dana', enumOptions: ['CASH','TRANSFER','CREDIT'] },
      { name: 'partnerId', type: 'uuid', required: false, description: 'ID pemasok / mitra yang dibayar' },
      { name: 'createdBy', type: 'string', required: true, description: 'User yang mencatat pengeluaran' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan tambahan' },
    ],
  },
  commands: [
    { name: 'RecordExpense', description: 'Catat pengeluaran operasional baru', parameters: [
      { name: 'categoryId', type: 'uuid', required: true, description: 'ID kategori BOP' },
      { name: 'amount', type: 'number', required: true, description: 'Nilai (IDR)' },
      { name: 'description', type: 'string', required: true, description: 'Deskripsi' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal' },
      { name: 'cycleId', type: 'uuid', required: false, description: 'ID siklus (opsional)' },
      { name: 'source', type: 'string', required: false, description: 'Sumber dana' },
      { name: 'partnerId', type: 'uuid', required: false, description: 'ID pemasok' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'ExpenseRecorded', idempotent: true },
    { name: 'VoidExpense', description: 'Void pengeluaran yang salah', parameters: [
      { name: 'expenseEventId', type: 'uuid', required: true, description: 'ID expense event' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], emitsEvent: 'ExpenseVoided', idempotent: true },
  ],
  events: [
    { name: 'ExpenseRecorded', description: 'Pengeluaran operasional dicatat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
      { name: 'cycleId', type: 'uuid', required: false, description: 'ID siklus (jika ada)' },
      { name: 'categoryId', type: 'uuid', required: true, description: 'ID kategori BOP' },
      { name: 'amount', type: 'number', required: true, description: 'Nilai (IDR)' },
      { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'ExpenseVoided', description: 'Pengeluaran dibatalkan / void', payload: [
      { name: 'expenseEventId', type: 'uuid', required: true, description: 'Target Expense ID' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'BOPBreakdown', target: 'AquaCycleBOPBreakdown', description: 'Rincian BOP per kategori per siklus: pakan, benih, obat, tenaga kerja, overhead', frequency: 'INSTANT' },
    { name: 'BOPvsRevenue', target: 'AquaCycleProfitLoss', description: 'Perbandingan BOP vs revenue siklus untuk hitung laba bersih', frequency: 'CYCLE_CLOSE' },
    { name: 'MonthlyExpenseSummary', target: 'MonthlyExpenseSummary', description: 'Ringkasan pengeluaran bulanan per kategori untuk cashflow tenant', frequency: 'DAILY' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'IMMUTABLE_APPEND' },
  offline: { supported: true, storageTarget: 'aqua_expense_events', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
