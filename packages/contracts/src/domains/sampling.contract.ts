// packages/contracts/src/domains/sampling.contract.ts
// CultivationContext: sample count, ABW (Average Body Weight), ADG (Average Daily Gain)
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const SamplingContract = defineDomainContract({
  name: 'AquaSamplingEvent',
  version: '1.0.0',
  cluster: 'Hulu',
  applicableBusinessTypes: [BusinessType.CULTIVATOR],
  entity: {
    name: 'AquaSamplingEvent',
    description: 'Sampling bobot ikan secara berkala untuk menghitung ABW dan proyeksi ADG',
    backendPrismaModel: 'AquaSamplingEvent',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus budidaya aktif' },
      { name: 'eventAt', type: 'date', required: true, description: 'Waktu pengambilan sampel' },
      { name: 'averageWeightGram', type: 'number', required: true, unit: 'gram', description: 'Rata-rata bobot per ekor (gram) = ABW', validationRule: 'averageWeightGram > 0' },
      { name: 'sampleCountPcs', type: 'number', required: false, unit: 'ekor', description: 'Jumlah sampel yang ditimbang' },
      { name: 'createdBy', type: 'string', required: true, description: 'Teknisi kolam yang melakukan sampling' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan kondisi ikan saat sampling' },
    ],
  },
  commands: [
    { name: 'RecordSampling', description: 'Catat data sampling bobot ikan', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'averageWeightGram', type: 'number', required: true, description: 'ABW (gram)' },
      { name: 'sampleCountPcs', type: 'number', required: false, description: 'Jumlah sampel' },
      { name: 'eventAt', type: 'date', required: true, description: 'Waktu sampling' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'SamplingRecorded', idempotent: true },
    { name: 'VoidSampling', description: 'Void data sampling yang salah', parameters: [
      { name: 'samplingEventId', type: 'uuid', required: true, description: 'ID event sampling' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], emitsEvent: 'SamplingVoided', idempotent: true },
  ],
  events: [
    { name: 'SamplingRecorded', description: 'Data sampling bobot ikan berhasil dicatat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'averageWeightGram', type: 'number', required: true, description: 'ABW (gram)' },
      { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'SamplingVoided', description: 'Data sampling dibatalkan', payload: [
      { name: 'samplingEventId', type: 'uuid', required: true, description: 'Target Sampling ID' },
      { name: 'reason', type: 'string', required: true, description: 'Alasan void' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'ABWTimeline', target: 'AquaCycleABWTimeline', description: 'Grafik tren ABW per hari untuk monitoring pertumbuhan ikan', frequency: 'INSTANT' },
    { name: 'ADGProjection', target: 'AquaCycleADGProjection', description: 'ADG = (ABW hari ini - ABW sebelumnya) / selisih hari; proyeksi hari panen', frequency: 'INSTANT' },
    { name: 'FCRUpdate', target: 'AquaCultureCycleBiomassFCR', description: 'Update estimasi FCR berdasarkan biomassa terbaru', frequency: 'INSTANT' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'IMMUTABLE_APPEND' },
  offline: { supported: true, storageTarget: 'aqua_sampling_events', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
