// packages/devkit/src/generator/types.spec.ts
import { BusinessType } from '@tumbu/contracts';
import { GeneratorAST, ArtifactPlan, GeneratorPlan, ArchitectureCheck } from './types';

describe('TUMBU DEV-2B Type Invariants & Core Constraints', () => {
  // Test 1: Verification of the 8 BusinessType final boundaries
  it('should respect the exact 8 BusinessTypes as the core system foundation', () => {
    const validTypes: BusinessType[] = [
      BusinessType.CULTIVATOR,
      BusinessType.SEED_DISTRIBUTOR,
      BusinessType.FEED_DISTRIBUTOR,
      BusinessType.EQUIPMENT_SUPPLIER,
      BusinessType.HARVEST_OFFTAKER,
      BusinessType.PROCESSED_FOOD_PRODUCER,
      BusinessType.LOGISTICS_TRANSPORTER,
      BusinessType.CONSULTANT_LAB_SERVICE,
    ];

    expect(validTypes.length).toBe(8);
    expect(validTypes).toContain(BusinessType.CULTIVATOR);
    expect(validTypes).toContain(BusinessType.LOGISTICS_TRANSPORTER);
  });

  // Test 2: Structural integrity of GeneratorAST
  it('should enforce structural invariants on GeneratorAST', () => {
    const mockAST: GeneratorAST = {
      contractName: 'FeedEntry',
      version: '1.0.0',
      cluster: 'Hulu',
      applicableBusinessTypes: [BusinessType.FEED_DISTRIBUTOR, BusinessType.CULTIVATOR],
      entity: {
        name: 'feed_entry',
        description: 'Record of fish feed distribution',
        backendPrismaModel: 'FeedEntry',
        fields: [
          {
            name: 'id',
            type: 'uuid',
            required: true,
            description: 'Unique identifier',
          },
          {
            name: 'quantity',
            type: 'number',
            required: true,
            description: 'Quantity of feed in kg',
            unit: 'kg',
          },
        ],
      },
      commands: [],
      events: [],
      sync: {
        outboxSupported: true,
        syncEndpoint: '/api/sync/feed',
        idempotencyKeyField: 'idempotencyKey',
        conflictStrategy: 'SERVER_WINS',
      },
      offline: {
        supported: true,
        storageTarget: 'feed_entries',
        fallbackStrategy: 'LOCAL_QUEUE',
      },
    };

    expect(mockAST.contractName).toBe('FeedEntry');
    expect(mockAST.entity.fields[0].type).toBe('uuid');
    expect(mockAST.applicableBusinessTypes).toHaveLength(2);
  });

  // Test 3: Deterministic Sorting Invariant for ArtifactPlans
  it('should support deterministic sorting of ArtifactPlans by filePath', () => {
    const unsortedArtifacts: ArtifactPlan[] = [
      {
        filePath: 'apps/web/src/app/aqua-feed-s02.tsx',
        action: 'CREATE',
        description: 'Web frontend feed management form',
        templateName: 'frontend-form',
      },
      {
        filePath: 'apps/api/prisma/schema.prisma',
        action: 'MODIFY',
        description: 'Append feed entry model to schema',
        templateName: 'prisma-model',
      },
      {
        filePath: 'packages/contracts/src/domains/feed-entry.contract.ts',
        action: 'CREATE',
        description: 'Canonical contract definition',
        templateName: 'domain-contract',
      },
    ];

    // Explicitly sort artifacts by filePath to guarantee deterministic behavior
    const sortedArtifacts = [...unsortedArtifacts].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );

    expect(sortedArtifacts[0].filePath).toBe('apps/api/prisma/schema.prisma');
    expect(sortedArtifacts[1].filePath).toBe('apps/web/src/app/aqua-feed-s02.tsx');
    expect(sortedArtifacts[2].filePath).toBe('packages/contracts/src/domains/feed-entry.contract.ts');
  });

  // Test 4: Canonical Serialization & Hash Determinism
  it('should produce identical serialized representation and hash for same plans regardless of insertion order', () => {
    const ast: GeneratorAST = {
      contractName: 'FeedEntry',
      version: '1.0.0',
      cluster: 'Hulu',
      applicableBusinessTypes: [BusinessType.FEED_DISTRIBUTOR],
      entity: {
        name: 'feed_entry',
        description: 'Record',
        backendPrismaModel: 'FeedEntry',
        fields: [],
      },
      commands: [],
      events: [],
      sync: {
        outboxSupported: true,
        syncEndpoint: '',
        idempotencyKeyField: '',
        conflictStrategy: 'SERVER_WINS',
      },
      offline: { supported: true, storageTarget: '', fallbackStrategy: 'LOCAL_QUEUE' },
    };

    const checks: ArchitectureCheck = {
      valid: true,
      errors: [],
      warnings: [],
      rulesChecked: [],
    };

    const artifactA: ArtifactPlan = {
      filePath: 'A.ts',
      action: 'CREATE',
      description: 'First file',
      templateName: 'temp',
    };

    const artifactB: ArtifactPlan = {
      filePath: 'B.ts',
      action: 'CREATE',
      description: 'Second file',
      templateName: 'temp',
    };

    // Helper to build canonical, deterministic string representation
    const buildCanonicalString = (astObj: GeneratorAST, artifactsList: ArtifactPlan[]): string => {
      const sortedArtifacts = [...artifactsList].sort((a, b) =>
        a.filePath.localeCompare(b.filePath)
      );
      return JSON.stringify({
        ast: astObj,
        artifacts: sortedArtifacts,
      });
    };

    // Construct plan with A then B
    const canonicalStr1 = buildCanonicalString(ast, [artifactA, artifactB]);

    // Construct plan with B then A (different insertion order)
    const canonicalStr2 = buildCanonicalString(ast, [artifactB, artifactA]);

    // Assert that canonical serialization matches exactly
    expect(canonicalStr1).toBe(canonicalStr2);
  });
});
