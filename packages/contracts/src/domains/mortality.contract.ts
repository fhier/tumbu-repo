// packages/contracts/src/domains/mortality.contract.ts
// CultivationContext: mortalitas harian & penyebab kematian
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const MortalityContract = defineDomainContract({
  name: 'AquaMortalityEvent',
  version: '1.0.0',
  cluster: 'Hulu',
  applicableBusinessTypes: [BusinessType.CULTIVATOR],
  entity: {
    name: 'AquaMortalityEvent',
    description: 'Pencatatan kematian ikan harian beserta penyebabnya untuk menghitung Survival Rate (SR)',
    backendPrismaModel: 'AquaMortalityEvent',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus budidaya' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal kematian dicatat' },
      { name: 'deadCountPcs', type: 'number', required: true, unit: 'ekor', description: 'Jumlah ikan yang mati', validationRule: 'deadCountPcs > 0' },
      { name: 'cause', type: 'string', required: false, description: 'Penyebab kematian (opsional dari master AquaMortalityCause)' },
      { name: 'createdBy', type: 'string', required: true, description: 'Teknisi kolam yang mencatat' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan deskriptif kondisi kematian' },
    ],
  },
  commands: [
    { name: 'RecordMortality', description: 'Catat kematian ikan harian', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'deadCountPcs', type: 'number', required: true, description: 'Jumlah mati (ekor)' },
      { name: 'cause', type: 'string', required: false, description: 'Penyebab (pilih dari master)' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal kejadian' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'MortalityRecorded', idempotent: true },
    { name: 'VoidMortality', description: 'Void catatan mortalitas yang keliru', parameters: [
      { name: 'mortalityEventId', type: 'uuid', required: true, description: 'ID event mortalitas' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], emitsEvent: 'MortalityVoided', idempotent: true },
  ],
  events: [
    { name: 'MortalityRecorded', description: 'Kematian ikan dicatat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'deadCountPcs', type: 'number', required: true, description: 'Jumlah mati' },
      { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'MortalityVoided', description: 'Catatan mortalitas dibatalkan', payload: [
      { name: 'mortalityEventId', type: 'uuid', required: true, description: 'Target ID' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], isImmutable: true },
    { name: 'MortalityAlertTriggered', description: 'Peringatan SR di bawah ambang aman', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'currentSrPct', type: 'number', required: true, description: 'SR terkini (%)' },
      { name: 'threshold', type: 'number', required: true, description: 'Ambang batas SR (%)' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'DailySRProjection', target: 'AquaCycleSurvivalRate', description: 'Hitung Survival Rate kumulatif siklus: SR = (populasi awal - total mati) / populasi awal × 100', frequency: 'INSTANT' },
    { name: 'MortalityCauseBreakdown', target: 'AquaMortalityCauseBreakdown', description: 'Distribusi penyebab kematian per siklus untuk analisa penyakit', frequency: 'DAILY' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'IMMUTABLE_APPEND' },
  offline: { supported: true, storageTarget: 'aqua_mortality_events', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
