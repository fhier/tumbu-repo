/**
 * Enum / lookup logical Budidaya (DATA-MODEL §7).
 * 8.1: kontrak string saja — belum dienforce di DB sebagai enum Postgres.
 */

export const CYCLE_STATES = [
  'PLANNED',
  'READY',
  'ACTIVE',
  'HARVESTING',
  'CLOSED',
  'CANCELLED',
] as const;
export type CycleState = (typeof CYCLE_STATES)[number];

export const COST_CLASSES = ['DIRECT', 'INDIRECT'] as const;
export type CostClass = (typeof COST_CLASSES)[number];

export const COST_NATURES = ['VARIABLE', 'FIXED'] as const;
export type CostNature = (typeof COST_NATURES)[number];

export const POND_STATUSES = ['IDLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'] as const;
export type PondStatus = (typeof POND_STATUSES)[number];

export const METRIC_DIRECTIONS = ['LOWER_BETTER', 'HIGHER_BETTER'] as const;
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];

export const MEDICINE_KINDS = ['OBAT', 'VITAMIN', 'LAINNYA'] as const;
export type MedicineKind = (typeof MEDICINE_KINDS)[number];

export const BLUEPRINT_ID_AQUACULTURE = 'operational_aquaculture_freshwater' as const;
