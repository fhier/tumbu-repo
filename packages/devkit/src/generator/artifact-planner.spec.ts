// packages/devkit/src/generator/artifact-planner.spec.ts
import { FeedEntryContract } from '@tumbu/contracts/dist/domains/feed-entry.contract';
import { ASTParser } from './ast-parser';
import { ArtifactPlanner } from './artifact-planner';
import { BusinessType, DomainContract } from '@tumbu/contracts';

describe('ArtifactPlanner (TUMBU DEV-2B Stage 3)', () => {
  it('should generate a valid ArtifactPlan[] from FeedEntry AST', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
  });

  it('should ensure each artifact has a non-empty filePath, action, and templateName', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);

    plans.forEach((plan: any) => {
      expect(plan.filePath).toBeTruthy();
      expect(['CREATE', 'MODIFY', 'APPEND']).toContain(plan.action);
      expect(plan.templateName).toBeTruthy();
      expect(plan.description).toBeTruthy();
    });
  });

  it('should sort artifacts alphabetically by filePath to guarantee determinism', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);

    for (let i = 0; i < plans.length - 1; i++) {
      const compareResult = plans[i].filePath.localeCompare(plans[i + 1].filePath);
      expect(compareResult).toBeLessThanOrEqual(0);
    }
  });

  it('should produce identical ArtifactPlan[] for identical AST inputs', () => {
    const ast1 = ASTParser.parse(FeedEntryContract);
    const ast2 = ASTParser.parse(FeedEntryContract);

    const plans1 = ArtifactPlanner.plan(ast1);
    const plans2 = ArtifactPlanner.plan(ast2);

    expect(plans1).toEqual(plans2);
  });

  it('should produce identical ArtifactPlan[] for reordered AST inputs', () => {
    const testContract1: DomainContract = {
      name: 'TestDomain',
      version: '1.0.0',
      cluster: 'Hulu',
      applicableBusinessTypes: [BusinessType.CULTIVATOR, BusinessType.FEED_DISTRIBUTOR],
      entity: {
        name: 'test_entity',
        description: 'test',
        backendPrismaModel: 'TestEntity',
        fields: [
          { name: 'id', type: 'uuid', required: true, description: 'id' },
          { name: 'amount', type: 'number', required: true, description: 'amount' }
        ],
      },
      commands: [],
      events: [],
      projections: [],
      sync: {
        outboxSupported: true,
        syncEndpoint: '/api/sync',
        idempotencyKeyField: 'id',
        conflictStrategy: 'SERVER_WINS',
      },
      offline: {
        supported: true,
        storageTarget: 'local',
        fallbackStrategy: 'LOCAL_QUEUE',
      },
      architectureInvariants: [],
    };

    // Swapping order of business types in the contract object, though parser already normalizes it.
    const testContract2: DomainContract = {
      ...testContract1,
      applicableBusinessTypes: [BusinessType.FEED_DISTRIBUTOR, BusinessType.CULTIVATOR],
    };

    const ast1 = ASTParser.parse(testContract1);
    const ast2 = ASTParser.parse(testContract2);

    const plans1 = ArtifactPlanner.plan(ast1);
    const plans2 = ArtifactPlanner.plan(ast2);

    expect(plans1).toEqual(plans2);
  });

  it('should not mutate the input AST', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const originalAstJson = JSON.stringify(ast);

    ArtifactPlanner.plan(ast);

    expect(JSON.stringify(ast)).toBe(originalAstJson);
  });

  it('should perform no filesystem operations during planning', () => {
    const fs = require('fs');
    const spyWriteFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const spyWriteFileAsync = jest.spyOn(fs, 'writeFile').mockImplementation(() => {});

    const ast = ASTParser.parse(FeedEntryContract);
    ArtifactPlanner.plan(ast);

    expect(spyWriteFile).not.toHaveBeenCalled();
    expect(spyWriteFileAsync).not.toHaveBeenCalled();

    spyWriteFile.mockRestore();
    spyWriteFileAsync.mockRestore();
  });
});
