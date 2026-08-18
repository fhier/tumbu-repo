// packages/contracts/src/domains/harvest.contract.ts
// CultivationContext & Offtaker: panen, tonase, SR, FCR, harga jual
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const HarvestContract = defineDomainContract({
  name: 'AquaHarvestEvent',
  version: '1.0.0',
  cluster: 'Hulu',
  applicableBusinessTypes: [BusinessType.CULTIVATOR, BusinessType.HARVEST_OFFTAKER],
  entity: {
    name: 'AquaHarvestEvent',
    description: 'Event panen siklus budidaya — mencakup tonase, grade, SR final, FCR aktual, dan harga jual',
    backendPrismaModel: 'AquaHarvestEvent',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Client-generated UUID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus budidaya' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal / jam panen' },
      { name: 'quantityKg', type: 'number', required: true, unit: 'kg', description: 'Total tonase panen (kg)', validationRule: 'quantityKg > 0' },
      { name: 'quantityPcs', type: 'number', required: true, unit: 'ekor', description: 'Total jumlah ikan dipanen (ekor)', validationRule: 'quantityPcs > 0' },
      { name: 'grade', type: 'string', required: false, description: 'Grade ikan: A / B / C / Mixed / Sortir' },
      { name: 'pricePerKg', type: 'number', required: false, unit: 'IDR/kg', description: 'Harga jual per kg saat panen' },
      { name: 'totalRevenue', type: 'number', required: false, unit: 'IDR', description: 'Total penerimaan panen = quantityKg × pricePerKg' },
      { name: 'buyerPartnerId', type: 'uuid', required: false, description: 'ID mitra pembeli / offtaker' },
      { name: 'createdBy', type: 'string', required: true, description: 'Penanggung jawab panen' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan panen (kondisi ikan, transportasi, dll)' },
    ],
  },
  commands: [
    { name: 'RecordHarvest', description: 'Catat event panen siklus', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'quantityKg', type: 'number', required: true, description: 'Tonase (kg)' },
      { name: 'quantityPcs', type: 'number', required: true, description: 'Jumlah ekor' },
      { name: 'grade', type: 'string', required: false, description: 'Grade ikan' },
      { name: 'pricePerKg', type: 'number', required: false, description: 'Harga/kg (IDR)' },
      { name: 'buyerPartnerId', type: 'uuid', required: false, description: 'ID pembeli' },
      { name: 'eventAt', type: 'date', required: true, description: 'Tanggal panen' },
      { name: 'notes', type: 'string', required: false, description: 'Catatan' },
    ], emitsEvent: 'HarvestRecorded', idempotent: true },
    { name: 'FinalizeHarvest', description: 'Tandai siklus sebagai HARVESTED dan hitung FCR, SR, BEP final', parameters: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'totalFeedKg', type: 'number', required: true, description: 'Total pakan terpakai (kg) untuk hitung FCR' },
      { name: 'totalMortalityPcs', type: 'number', required: true, description: 'Total kematian (ekor) untuk hitung SR' },
      { name: 'totalExpenseIdr', type: 'number', required: true, description: 'Total BOP siklus (IDR)' },
    ], emitsEvent: 'HarvestFinalized', idempotent: true },
  ],
  events: [
    { name: 'HarvestRecorded', description: 'Event panen dicatat', payload: [
      { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'quantityKg', type: 'number', required: true, description: 'Tonase (kg)' },
      { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
    ], isImmutable: true },
    { name: 'HarvestFinalized', description: 'Siklus dinyatakan selesai panen beserta metrik akhir', payload: [
      { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
      { name: 'finalFcr', type: 'number', required: true, description: 'FCR final = total pakan / total biomassa panen' },
      { name: 'finalSrPct', type: 'number', required: true, description: 'SR final (%)' },
      { name: 'totalRevenueIdr', type: 'number', required: true, description: 'Total revenue (IDR)' },
      { name: 'totalExpenseIdr', type: 'number', required: true, description: 'Total BOP (IDR)' },
      { name: 'netProfitIdr', type: 'number', required: true, description: 'Laba bersih siklus (IDR)' },
    ], isImmutable: true },
  ],
  projections: [
    { name: 'CycleFinalMetrics', target: 'AquaCycleFinalMetrics', description: 'Ringkasan FCR, SR, BEP, profit untuk laporan akhir siklus', frequency: 'CYCLE_CLOSE' },
    { name: 'HarvestRevenueReport', target: 'AquaHarvestRevenueReport', description: 'Laporan pendapatan panen per periode untuk analisa cashflow budidaya', frequency: 'DAILY' },
  ],
  sync: { outboxSupported: true, syncEndpoint: '/api/sync/push', idempotencyKeyField: 'clientEventId', conflictStrategy: 'IMMUTABLE_APPEND' },
  offline: { supported: true, storageTarget: 'aqua_harvest_events', fallbackStrategy: 'LOCAL_QUEUE' },
  architectureInvariants: ['TUMBU-ARCH-001','TUMBU-ARCH-002','TUMBU-ARCH-003','TUMBU-ARCH-004','TUMBU-ARCH-005','TUMBU-ARCH-006','TUMBU-ARCH-007'],
});
