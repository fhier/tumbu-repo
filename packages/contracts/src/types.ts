// packages/contracts/src/types.ts
// TUMBU Canonical Contract Definitions & Architecture Invariants

export type ArchitectureRuleId =
  | 'TUMBU-ARCH-001' // Backend must remain source of truth
  | 'TUMBU-ARCH-002' // Offline mutations must enter Outbox
  | 'TUMBU-ARCH-003' // Sync push must be idempotent
  | 'TUMBU-ARCH-004' // Dexie contract must match canonical domain contract
  | 'TUMBU-ARCH-005' // Forbidden production dependencies are not allowed
  | 'TUMBU-ARCH-006' // Domain mutation must have deterministic validation
  | 'TUMBU-ARCH-007'; // BusinessType restrictions must be respected

export type EvaluationStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_VERIFIED';

export enum BusinessType {
  CULTIVATOR = 'CULTIVATOR',
  SEED_DISTRIBUTOR = 'SEED_DISTRIBUTOR',
  FEED_DISTRIBUTOR = 'FEED_DISTRIBUTOR',
  EQUIPMENT_SUPPLIER = 'EQUIPMENT_SUPPLIER',
  HARVEST_OFFTAKER = 'HARVEST_OFFTAKER',
  PROCESSED_FOOD_PRODUCER = 'PROCESSED_FOOD_PRODUCER',
  LOGISTICS_TRANSPORTER = 'LOGISTICS_TRANSPORTER',
  CONSULTANT_LAB_SERVICE = 'CONSULTANT_LAB_SERVICE',
}

export type FieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json' | 'uuid';

export interface FieldContract {
  name: string;
  type: FieldDataType;
  required: boolean;
  description: string;
  enumOptions?: string[];
  unit?: string;
  validationRule?: string;
}

export interface CommandContract {
  name: string;
  description: string;
  parameters: FieldContract[];
  emitsEvent: string;
  idempotent: boolean;
}

export interface EventContract {
  name: string;
  description: string;
  payload: FieldContract[];
  isImmutable: boolean;
}

export interface ProjectionContract {
  name: string;
  target: string;
  description: string;
  frequency: 'INSTANT' | 'DAILY' | 'CYCLE_CLOSE';
}

export interface SyncContract {
  outboxSupported: boolean;
  syncEndpoint: string;
  idempotencyKeyField: string;
  conflictStrategy: 'SERVER_WINS' | 'LAST_WRITE_WINS' | 'IMMUTABLE_APPEND';
}

export interface OfflineContract {
  supported: boolean;
  storageTarget: string; // e.g. IndexedDB table name
  fallbackStrategy: 'LOCAL_QUEUE' | 'BLOCK';
}

export interface DomainContract {
  name: string;
  version: string;
  cluster: 'Hulu' | 'Inti' | 'Hilir' | 'Penunjang' | 'Cross-Cluster';
  applicableBusinessTypes: BusinessType[];
  entity: {
    name: string;
    description: string;
    backendPrismaModel: string;
    fields: FieldContract[];
  };
  commands: CommandContract[];
  events: EventContract[];
  projections: ProjectionContract[];
  sync: SyncContract;
  offline: OfflineContract;
  architectureInvariants: ArchitectureRuleId[];
}

export interface RuleDefinition {
  id: ArchitectureRuleId;
  title: string;
  description: string;
  severity: 'BLOCKING' | 'CRITICAL' | 'WARNING';
  rationale: string;
}
