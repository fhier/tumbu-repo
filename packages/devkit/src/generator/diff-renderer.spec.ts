// packages/devkit/src/generator/diff-renderer.spec.ts
import { FeedEntryContract } from '@tumbu/contracts/dist/domains/feed-entry.contract';
import { ASTParser } from './ast-parser';
import { ArtifactPlanner } from './artifact-planner';
import { ArchitecturePreChecker } from './pre-checker';
import { GeneratorPlanBuilder } from './generator-plan';
import { DiffRenderer } from './diff-renderer';

describe('DiffRenderer (TUMBU DEV-2B Stage 6)', () => {
  it('should generate valid DiffPreview[] representing all artifacts in GeneratorPlan', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);
    const checks = ArchitecturePreChecker.check(ast, plans);
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    const previews = DiffRenderer.render(plan);

    expect(Array.isArray(previews)).toBe(true);
    expect(previews.length).toBe(plans.length);

    // Verify properties
    previews.forEach((preview, index) => {
      expect(preview.filePath).toBe(plans[index].filePath);
      expect(preview.action).toBe(plans[index].action);
      expect(Array.isArray(preview.diffLines)).toBe(true);
      expect(preview.diffLines.length).toBeGreaterThan(0);
    });
  });

  it('should ensure the preview output order is strictly sorted alphabetically by filePath', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);
    const checks = ArchitecturePreChecker.check(ast, plans);
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    const previews = DiffRenderer.render(plan);

    for (let i = 0; i < previews.length - 1; i++) {
      const compare = previews[i].filePath.localeCompare(previews[i + 1].filePath);
      expect(compare).toBeLessThanOrEqual(0);
    }
  });

  it('should render a clean and highly structured string output via renderToString', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);
    const checks = ArchitecturePreChecker.check(ast, plans);
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    const previews = DiffRenderer.render(plan);
    const resultString = DiffRenderer.renderToString(previews, plan.hash);

    expect(typeof resultString).toBe('string');
    expect(resultString.includes('TUMBU GENERATOR DRY-RUN PREVIEW')).toBe(true);
    expect(resultString.includes(plan.hash)).toBe(true);
    expect(resultString.includes('File:')).toBe(true);
    expect(resultString.includes('Action:')).toBe(true);
  });

  it('should not mutate the input GeneratorPlan', () => {
    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);
    const checks = ArchitecturePreChecker.check(ast, plans);
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    const originalPlanJson = JSON.stringify(plan);
    DiffRenderer.render(plan);

    expect(JSON.stringify(plan)).toBe(originalPlanJson);
  });

  it('should perform no filesystem writes or operations', () => {
    const fs = require('fs');
    const spyWriteFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const spyWriteFileAsync = jest.spyOn(fs, 'writeFile').mockImplementation(() => {});

    const ast = ASTParser.parse(FeedEntryContract);
    const plans = ArtifactPlanner.plan(ast);
    const checks = ArchitecturePreChecker.check(ast, plans);
    const plan = GeneratorPlanBuilder.build(ast, plans, checks);

    DiffRenderer.render(plan);

    expect(spyWriteFile).not.toHaveBeenCalled();
    expect(spyWriteFileAsync).not.toHaveBeenCalled();

    spyWriteFile.mockRestore();
    spyWriteFileAsync.mockRestore();
  });
});
