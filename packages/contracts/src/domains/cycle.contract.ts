// packages/contracts/src/domains/cycle.contract.ts
// CultivationContext: stocking, komoditas, status siklus
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const CycleContract = defineDomainContract({
  name: 'AquaCultureCycle',
  version: '1.0.0',
  cluster: 'Hulu',
  applicableBusinessTypes: [BusinessType.CULTIVATOR],
  entity: {
    name: 'AquaCultureCycle',
    description: 'Siklus budidaya kolam dari penebaran benih (stocking) hingga panen',
    backendPrismaModel: 'AquaCultureCycle',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'pondId', type: 'uuid', required: true, description: 'ID kolam (AquaPond)' },
      { name: 'speciesProfileId', type: 'uuid', required: true, description: 'ID profil spesies ikan' },
      { name: 'code', type: 'string', required: true, description: 'Kode unik siklus, mis. CLK-2025-001' },
      { name: 'state', type: 'enum', required: true, description: 'Status siklus budidaya', enumOptions: ['PLANNED','ACTIVE','HARVESTED','CLOSED','ABORTED'] },
      { name: 'startedAt', type: 'date', required: false, description: 'Tanggal tebar benih aktual' },
      { name: 'targetFcr', type: 'number', required: false, unit: 'ratio', description: 'Target FCR siklus ini' },
      { name: 'targetSrPct', type: 'number', required: false, unit: '%', description: 'Target Survival Rate (%)' },
      { name: 'targetWeightGram', type: 'number', required: false, unit: 'gram', description: 'Target ABW panen (gram)' },
      { name: 'targetDays', type: 'number', required: false, unit: 'hari', description: 'Estimasi durasi siklus (hari)' },
      { name: 'targetBopAmount', type: 'number', required: false, unit: 'IDR', description: 'Target Biaya Operasional Pokok' },
      { name: 'targetHarvestKg', type: 'number', required: false, unit: 'kg', description: 'Target tonase panen (kg)' },
      { name: 'targetRevenue', type: 'number', required: false, unit: 'IDR', description: 'Target revenue siklus (IDR)' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan tambahan siklus' },
    ],
  },
  commands: [
    { name: 'CreateCycle', description: 'Buat siklus budidaya baru dalam status PLANNED', parameters: [
      { name: 'pondId', type: 'uuid', required: true, description: 'ID kolam' },
      { name: 'speciesProfileId', type: 'uuid', required: true, description: 'ID spesies' },
      { name: 'targetFcr', type: 'number', required: false, description: 'Target FCR' },
      { name: 'targetDays', type: 'number', required: false, description: 'Durasi rencana (hari)' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'CycleCreated', idempotent: true },
    { name: 'StartCycle', description: 'Mulai siklus (PLANNED → ACTIVE), catat penebaran benih pertama', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'startedAt', type: 'date', required: true, description: 'Tanggal tebar benih' },
      { name: 'initialCapital', type: 'number', required: false, description: 'Modal awal (IDR)' },
    ], emitsEvent: 'CycleStarted', idempotent: true },
    { name: 'CloseCycle', description: 'Tutup siklus (HARVESTED → CLOSED)', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'CycleClosed', idempotent: true },
    { name: 'AbortCycle', description: 'Batalkan siklus', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan' },
    ], emitsEvent: 'CycleAborted', idempotent: true },
  ],
  events: [
    { name: 'CycleCreated', description: 'Siklus budidaya baru dibuat', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'pondId', type: 'uuid', required: true, description: 'ID kolam' },
    ], isImmutable: true },
    { name: 'CycleStarted', description: 'Siklus mulai aktif, benih ditebar', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'startedAt', type: 'date', required: true, description: 'Tanggal tebar' },
    ], isImmutable: true },
    { name: 'CycleClosed', description: 'Siklus resmi ditutup setelah panen selesai', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'closedAt', type: 'date', required: true, description: 'Tanggal penutupan' },
    ], isImmutable: true },
    { name: 'CycleAborted', description: 'Siklus dibatalkan', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'CycleDashboard', target: 'AquaCultureCycleSummary', description: 'Dashboard ringkasan FCR, SR, biomassa, hari ke-', frequency: 'INSTANT' },
    { name: 'CycleHistoryReport', target: 'AquaCycleHistoryReport', description: 'Laporan riwayat siklus per kolam', frequency: 'CYCLE_CLOSE' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'SERVER_WINS' },
  offline: { supported: true, storageTarget: 'aqua_cycles', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
