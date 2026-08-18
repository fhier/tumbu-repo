// packages/devkit/src/generator/ast-parser.ts
import { DomainContract, BusinessType } from '@tumbu/contracts';
import { GeneratorAST, GeneratorField, GeneratorCommand, GeneratorEvent } from './types';

export class ASTParser {
  /**
   * Parses a canonical DomainContract into a normalized GeneratorAST.
   * This is a read-only operation that does not mutate the input contract.
   */
  public static parse(contract: DomainContract): GeneratorAST {
    if (!contract) {
      throw new Error('Contract is null or undefined');
    }
    if (!contract.name || typeof contract.name !== 'string') {
      throw new Error('Contract name is missing or invalid');
    }
    if (!contract.version || typeof contract.version !== 'string') {
      throw new Error('Contract version is missing or invalid');
    }
    if (!contract.cluster || typeof contract.cluster !== 'string') {
      throw new Error('Contract cluster is missing or invalid');
    }
    if (!contract.applicableBusinessTypes || !Array.isArray(contract.applicableBusinessTypes)) {
      throw new Error('Contract applicableBusinessTypes is missing or invalid');
    }
    if (!contract.entity) {
      throw new Error('Contract entity definition is missing');
    }
    if (!contract.entity.name || typeof contract.entity.name !== 'string') {
      throw new Error('Contract entity must have a valid name');
    }
    if (!contract.entity.backendPrismaModel || typeof contract.entity.backendPrismaModel !== 'string') {
      throw new Error('Contract entity must have a valid backendPrismaModel');
    }
    if (!contract.entity.fields || !Array.isArray(contract.entity.fields)) {
      throw new Error('Contract entity fields are missing or invalid');
    }

    // Sort business types to normalize them deterministically
    const normalizedBusinessTypes = [...contract.applicableBusinessTypes]
      .map(t => t as BusinessType)
      .sort((a, b) => a.localeCompare(b));

    // Deep clone and map fields to prevent mutations
    const mapFields = (fields: any[]): GeneratorField[] => {
      return fields.map(f => {
        if (!f.name || typeof f.name !== 'string') {
          throw new Error(`Field is missing required name or invalid: ${JSON.stringify(f)}`);
        }
        if (!f.type || typeof f.type !== 'string') {
          throw new Error(`Field is missing required type or invalid: ${JSON.stringify(f)}`);
        }
        return {
          name: f.name,
          type: f.type,
          required: f.required !== false, // Default to true if not explicitly false
          description: f.description || '',
          enumOptions: f.enumOptions ? [...f.enumOptions].sort((a, b) => a.localeCompare(b)) : undefined,
          unit: f.unit,
        };
      });
    };

    const entityFields = mapFields(contract.entity.fields);

    // Deep clone/map commands
    const commands: GeneratorCommand[] = (contract.commands || []).map(cmd => {
      if (!cmd.name || typeof cmd.name !== 'string') {
        throw new Error('Command is missing a valid name');
      }
      return {
        name: cmd.name,
        description: cmd.description || '',
        parameters: mapFields(cmd.parameters || []),
        emitsEvent: cmd.emitsEvent || '',
        idempotent: cmd.idempotent !== false,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort commands deterministically by name

    // Deep clone/map events
    const events: GeneratorEvent[] = (contract.events || []).map(evt => {
      if (!evt.name || typeof evt.name !== 'string') {
        throw new Error('Event is missing a valid name');
      }
      return {
        name: evt.name,
        description: evt.description || '',
        payload: mapFields(evt.payload || []),
        isImmutable: evt.isImmutable !== false,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort events deterministically by name

    if (!contract.sync) {
      throw new Error('Sync configuration is missing');
    }
    if (!contract.offline) {
      throw new Error('Offline configuration is missing');
    }

    return {
      contractName: contract.name,
      version: contract.version,
      cluster: contract.cluster,
      applicableBusinessTypes: normalizedBusinessTypes,
      entity: {
        name: contract.entity.name,
        description: contract.entity.description || '',
        backendPrismaModel: contract.entity.backendPrismaModel,
        fields: entityFields,
      },
      commands,
      events,
      sync: {
        outboxSupported: !!contract.sync.outboxSupported,
        syncEndpoint: contract.sync.syncEndpoint || '',
        idempotencyKeyField: contract.sync.idempotencyKeyField || '',
        conflictStrategy: contract.sync.conflictStrategy || 'SERVER_WINS',
      },
      offline: {
        supported: !!contract.offline.supported,
        storageTarget: contract.offline.storageTarget || '',
        fallbackStrategy: contract.offline.fallbackStrategy || 'LOCAL_QUEUE',
      },
    };
  }
}
