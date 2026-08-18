// packages/devkit/src/inspectors/domain-inspector.ts
import {
  DomainContract,
  BusinessType,
  FieldContract,
  CommandContract,
  EventContract,
  ProjectionContract,
} from '../../../contracts/src';
import { RepositoryEvidence } from '../evidence/evidence-collector';

export interface DomainInspectionTree {
  name: string;
  version: string;
  cluster: string;
  applicableBusinessTypes: string[];
  entity: {
    name: string;
    backendPrismaModel: string;
    fields: Array<{ name: string; type: string; required: boolean; unit?: string }>;
  };
  commands: Array<{ name: string; description: string; emitsEvent: string; idempotent: boolean }>;
  events: Array<{ name: string; description: string; isImmutable: boolean }>;
  projections: Array<{ name: string; target: string; description: string; frequency: string }>;
  sync: {
    outboxSupported: boolean;
    syncEndpoint: string;
    idempotencyKeyField: string;
    conflictStrategy: string;
  };
  offline: {
    supported: boolean;
    storageTarget: string;
    fallbackStrategy: string;
  };
  evidenceSummary: {
    prismaModelFound: boolean;
    indexedDbStoreFound: boolean;
    outboxFound: boolean;
    syncIdempotencyFound: boolean;
  };
}

export class DomainInspector {
  public inspect(contract: DomainContract, evidence: RepositoryEvidence): DomainInspectionTree {
    const prismaModelFound = evidence.prismaModels.has(contract.entity.backendPrismaModel);
    const indexedDbStoreFound = evidence.indexedDbStores.includes(contract.offline.storageTarget);

    return {
      name: contract.name,
      version: contract.version,
      cluster: contract.cluster,
      applicableBusinessTypes: contract.applicableBusinessTypes.map((b: BusinessType) => b.toString()),
      entity: {
        name: contract.entity.name,
        backendPrismaModel: contract.entity.backendPrismaModel,
        fields: contract.entity.fields.map((f: FieldContract) => ({
          name: f.name,
          type: f.type,
          required: f.required,
          unit: f.unit,
        })),
      },
      commands: contract.commands.map((c: CommandContract) => ({
        name: c.name,
        description: c.description,
        emitsEvent: c.emitsEvent,
        idempotent: c.idempotent,
      })),
      events: contract.events.map((e: EventContract) => ({
        name: e.name,
        description: e.description,
        isImmutable: e.isImmutable,
      })),
      projections: contract.projections.map((p: ProjectionContract) => ({
        name: p.name,
        target: p.target,
        description: p.description,
        frequency: p.frequency,
      })),
      sync: {
        outboxSupported: contract.sync.outboxSupported,
        syncEndpoint: contract.sync.syncEndpoint,
        idempotencyKeyField: contract.sync.idempotencyKeyField,
        conflictStrategy: contract.sync.conflictStrategy,
      },
      offline: {
        supported: contract.offline.supported,
        storageTarget: contract.offline.storageTarget,
        fallbackStrategy: contract.offline.fallbackStrategy,
      },
      evidenceSummary: {
        prismaModelFound,
        indexedDbStoreFound,
        outboxFound: evidence.hasOutboxStore,
        syncIdempotencyFound: evidence.hasSyncIdempotencyModel,
      },
    };
  }
}
