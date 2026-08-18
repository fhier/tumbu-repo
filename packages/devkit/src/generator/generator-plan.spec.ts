// packages/devkit/src/generator/generator-plan.spec.ts
import { FeedEntryContract } from '@tumbu/contracts/dist/domains/feed-entry.contract';
import { ASTParser } from './ast-parser';
import { ArtifactPlanner } from './artifact-planner';
import { ArchitecturePreChecker } from './pre-checker';
import { GeneratorPlanBuilder } from './generator-plan';
import { GeneratorAST, ArtifactPlan, ArchitectureCheck } from './types';

describe('GeneratorPlanBuilder (TUMBU DEV-2B Stage 5)', () => {
  let ast: GeneratorAST;
  let plans: ArtifactPlan[];
  let checks: ArchitectureCheck;

  beforeEach(() => {
    ast = ASTParser.parse(FeedEntryContract);
    plans = ArtifactPlanner.plan(ast);
    checks = ArchitecturePreChecker.check(ast, plans);
  });

  it('should successfully build a complete GeneratorPlan from inputs', () => {
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    expect(plan.contractName).toBe('FeedEntry');
    expect(plan.generatorVersion).toBe('1.0.0');
    expect(plan.ast).toBeDefined();
    expect(plan.artifacts).toBeDefined();
    expect(plan.checks).toBeDefined();
    expect(plan.hash).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(/^[a-f0-9]{64}$/.test(plan.hash)).toBe(true);
  });

  it('should produce an identical hash for identical generator inputs', () => {
    const plan1 = GeneratorPlanBuilder.build(ast, plans, checks);
    const plan2 = GeneratorPlanBuilder.build(ast, plans, checks);

    expect(plan1.hash).toBe(plan2.hash);
    expect(plan1).toEqual(plan2);
  });

  it('should be completely order-invariant when elements of arrays in input AST are shuffled', () => {
    // Clone AST to mutate orders
    const astShuffled = JSON.parse(JSON.stringify(ast)) as GeneratorAST;

    // Shuffle fields
    astShuffled.entity.fields.reverse();
    // Shuffle business types
    astShuffled.applicableBusinessTypes.reverse();

    const plan1 = GeneratorPlanBuilder.build(ast, plans, checks);
    const plan2 = GeneratorPlanBuilder.build(astShuffled, plans, checks);

    expect(plan1.hash).toBe(plan2.hash);
  });

  it('should guarantee that artifacts are sorted alphabetically by filePath in final output', () => {
    // Create pre-unsorted array of artifact plans
    const unsortedPlans: ArtifactPlan[] = [
      { filePath: 'z.ts', action: 'CREATE', description: 'z', templateName: 't' },
      { filePath: 'a.ts', action: 'CREATE', description: 'a', templateName: 't' },
    ];

    const plan = GeneratorPlanBuilder.build(ast, unsortedPlans, checks);
    expect(plan.artifacts[0].filePath).toBe('a.ts');
    expect(plan.artifacts[1].filePath).toBe('z.ts');
  });

  it('should not mutate the input arguments (ast, plans, or checks)', () => {
    const originalAST = JSON.stringify(ast);
    const originalPlans = JSON.stringify(plans);
    const originalChecks = JSON.stringify(checks);

    GeneratorPlanBuilder.build(ast, plans, checks);

    expect(JSON.stringify(ast)).toBe(originalAST);
    expect(JSON.stringify(plans)).toBe(originalPlans);
    expect(JSON.stringify(checks)).toBe(originalChecks);
  });

  it('should exclude any non-deterministic info like time and perform no physical filesystem writes', () => {
    const fs = require('fs');
    const spyWriteFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const spyWriteFileAsync = jest.spyOn(fs, 'writeFile').mockImplementation(() => {});

    const plan1 = GeneratorPlanBuilder.build(ast, plans, checks);

    // Sleep 5ms to guarantee potential timing differences if system clock is read
    const start = Date.now();
    while (Date.now() - start < 5) {}

    const plan2 = GeneratorPlanBuilder.build(ast, plans, checks);

    expect(plan1.hash).toBe(plan2.hash);
    expect(spyWriteFile).not.toHaveBeenCalled();
    expect(spyWriteFileAsync).not.toHaveBeenCalled();

    spyWriteFile.mockRestore();
    spyWriteFileAsync.mockRestore();
  });
});
