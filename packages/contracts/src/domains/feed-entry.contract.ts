// packages/contracts/src/domains/feed-entry.contract.ts
import { defineDomainContract } from '../domain-contract';
import { BusinessType } from '../types';

export const FeedEntryContract = defineDomainContract({
  name: 'FeedEntry',
  version: '1.0.0',
  cluster: 'Inti',
  applicableBusinessTypes: [BusinessType.CULTIVATOR],
  entity: {
    name: 'FeedEntry',
    description: 'Catat pemberian pakan harian pada siklus budidaya kolam aktif',
    backendPrismaModel: 'AquaFeedEvent',
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        description: 'Client-generated UUID identifier',
      },
      {
        name: 'cycleId',
        type: 'uuid',
        required: true,
        description: 'ID siklus budidaya (AquaCultureCycle) yang sedang aktif',
      },
      {
        name: 'feedTypeId',
        type: 'uuid',
        required: true,
        description: 'ID master pakan (AquaFeedType)',
      },
      {
        name: 'quantityKg',
        type: 'number',
        required: true,
        unit: 'kg',
        description: 'Jumlah pakan yang ditebar (dalam kilogram)',
        validationRule: 'quantityKg > 0',
      },
      {
        name: 'eventAt',
        type: 'date',
        required: true,
        description: 'Waktu pemberian pakan aktual di kolam',
      },
      {
        name: 'unitCost',
        type: 'number',
        required: false,
        unit: 'IDR',
        description: 'Estimasi harga per kg saat pemberian pakan',
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Catatan kondisi respons nafsu makan ikan atau cuaca',
      },
      {
        name: 'createdBy',
        type: 'string',
        required: true,
        description: 'User / teknisi kolam yang mencatat',
      },
    ],
  },
  commands: [
    {
      name: 'RecordFeed',
      description: 'Mencatat pemberian pakan baru ke dalam kolam',
      parameters: [
        { name: 'cycleId', type: 'uuid', required: true, description: 'ID siklus' },
        { name: 'feedTypeId', type: 'uuid', required: true, description: 'ID jenis pakan' },
        { name: 'quantityKg', type: 'number', required: true, description: 'Berat pakan (kg)' },
        { name: 'eventAt', type: 'date', required: true, description: 'Waktu tebar' },
        { name: 'notes', type: 'string', required: false, description: 'Catatan' },
      ],
      emitsEvent: 'FeedRecorded',
      idempotent: true,
    },
    {
      name: 'VoidFeed',
      description: 'Membatalkan / void catatan pakan yang salah input dengan audit trail',
      parameters: [
        { name: 'feedEventId', type: 'uuid', required: true, description: 'ID catatan pakan' },
        { name: 'reason', type: 'string', required: true, description: 'Alasan pembatalan' },
      ],
      emitsEvent: 'FeedVoided',
      idempotent: true,
    },
  ],
  events: [
    {
      name: 'FeedRecorded',
      description: 'Event immutable saat pakan berhasil dicatat di lokal atau server',
      payload: [
        { name: 'id', type: 'uuid', required: true, description: 'Event ID' },
        { name: 'cycleId', type: 'uuid', required: true, description: 'Cycle ID' },
        { name: 'quantityKg', type: 'number', required: true, description: 'Quantity (kg)' },
        { name: 'eventAt', type: 'date', required: true, description: 'Timestamp' },
      ],
      isImmutable: true,
    },
    {
      name: 'FeedVoided',
      description: 'Event immutable saat catatan pakan divoid',
      payload: [
        { name: 'feedEventId', type: 'uuid', required: true, description: 'Target Feed Event ID' },
        { name: 'reason', type: 'string', required: true, description: 'Void reason' },
        { name: 'voidedAt', type: 'date', required: true, description: 'Timestamp' },
      ],
      isImmutable: true,
    },
  ],
  projections: [
    {
      name: 'DailyFeedSummary',
      target: 'AquaCultureCycleDailySummary',
      description: 'Akumulasi total pakan harian untuk monitoring ritme makan harian',
      frequency: 'DAILY',
    },
    {
      name: 'CycleFCRProjection',
      target: 'AquaCultureCycleBiomassFCR',
      description: 'Proyeksi Feed Conversion Ratio (FCR = Total Pakan / Pertumbuhan Biomassa)',
      frequency: 'INSTANT',
    },
  ],
  sync: {
    outboxSupported: true,
    syncEndpoint: '/api/sync/push',
    idempotencyKeyField: 'clientEventId',
    conflictStrategy: 'IMMUTABLE_APPEND',
  },
  offline: {
    supported: true,
    storageTarget: 'aqua_feed_events',
    fallbackStrategy: 'LOCAL_QUEUE',
  },
  architectureInvariants: [
    'TUMBU-ARCH-001',
    'TUMBU-ARCH-002',
    'TUMBU-ARCH-003',
    'TUMBU-ARCH-004',
    'TUMBU-ARCH-005',
    'TUMBU-ARCH-006',
    'TUMBU-ARCH-007',
  ],
});
