// packages/contracts/src/domains/water-quality.contract.ts
// CultivationContext: kualitas air kolam — DO, pH, suhu, amonia, nitrit
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const WaterQualityContract = defineDomainContract({
  name: 'AquaWaterQualityEvent',
  version: '1.0.0',
  cluster: 'Hulu',
  applicableBusinessTypes: [BusinessType.CULTIVATOR],
  entity: {
    name: 'AquaWaterQualityEvent',
    description: 'Pencatatan kualitas air kolam: DO, pH, suhu, amonia (NH3), dan nitrit (NO2)',
    backendPrismaModel: 'AquaWaterQualityEvent',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus budidaya aktif' },
      { name: 'pondId', type: 'uuid', required: true, description: 'ID kolam yang diukur' },
      { name: 'eventAt', type: 'date', required: true, description: 'Waktu pengukuran' },
      { name: 'doMgL', type: 'number', required: false, unit: 'mg/L', description: 'Dissolved Oxygen (DO); ambang aman ≥ 5 mg/L', validationRule: 'doMgL >= 0' },
      { name: 'pH', type: 'number', required: false, unit: 'pH', description: 'Keasaman air; optimal 7.5–8.5', validationRule: 'pH >= 0 && pH <= 14' },
      { name: 'temperatureC', type: 'number', required: false, unit: '°C', description: 'Suhu air; optimal 26–30°C untuk lele', validationRule: 'temperatureC >= 0' },
      { name: 'ammoniaRaw', type: 'number', required: false, unit: 'mg/L', description: 'Total amonia (TAN/NH3); ambang aman < 0.02 mg/L', validationRule: 'ammoniaRaw >= 0' },
      { name: 'nitriteNo2', type: 'number', required: false, unit: 'mg/L', description: 'Nitrit (NO2); ambang aman < 0.1 mg/L', validationRule: 'nitriteNo2 >= 0' },
      { name: 'salinity', type: 'number', required: false, unit: 'ppt', description: 'Salinitas (untuk spesies air payau/laut)' },
      { name: 'turbidity', type: 'number', required: false, unit: 'NTU', description: 'Kekeruhan air' },
      { name: 'createdBy', type: 'string', required: true, description: 'Teknisi kolam yang mengukur' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan kondisi air atau tindakan koreksi' },
    ],
  },
  commands: [
    { name: 'RecordWaterQuality', description: 'Catat pengukuran kualitas air harian', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'pondId', type: 'uuid', required: true, description: 'ID kolam' },
      { name: 'eventAt', type: 'date', required: true, description: 'Waktu pengukuran' },
      { name: 'doMgL', type: 'number', required: false, description: 'DO (mg/L)' },
      { name: 'pH', type: 'number', required: false, description: 'pH' },
      { name: 'temperatureC', type: 'number', required: false, description: 'Suhu (°C)' },
      { name: 'ammoniaRaw', type: 'number', required: false, description: 'Amonia (mg/L)' },
      { name: 'nitriteNo2', type: 'number', required: false, description: 'Nitrit (mg/L)' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'WaterQualityRecorded', idempotent: true },
  ],
  events: [
    { name: 'WaterQualityRecorded', description: 'Data kualitas air berhasil dicatat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'doMgL', type: 'number', required: false, description: 'DO (mg/L)' },
      { name: 'pH', type: 'number', required: false, description: 'pH' },
      { name: 'temperatureC', type: 'number', required: false, description: 'Suhu (°C)' },
      { name: 'ammoniaRaw', type: 'number', required: false, description: 'Amonia (mg/L)' },
      { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'WaterQualityAlertTriggered', description: 'Peringatan parameter kualitas air melebihi ambang bahaya', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'alertType', type: 'string', required: true, description: 'Jenis parameter: DO_LOW | PH_DANGER | AMMONIA_HIGH | NITRITE_HIGH' },
      { name: 'value', type: 'number', required: true, description: 'Nilai yang memicu alert' },
      { name: 'threshold', type: 'number', required: true, description: 'Nilai ambang batas' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'WaterQualityDailyTrend', target: 'AquaWaterQualityTrend', description: 'Grafik tren kualitas air per parameter per hari', frequency: 'INSTANT' },
    { name: 'WaterQualityAlertLog', target: 'AquaWaterQualityAlertLog', description: 'Log peringatan kualitas air untuk referensi tindakan korektif', frequency: 'INSTANT' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'IMMUTABLE_APPEND' },
  offline: { supported: true, storageTarget: 'aqua_water_quality_events', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
