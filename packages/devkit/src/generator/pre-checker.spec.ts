// packages/devkit/src/generator/pre-checker.spec.ts
import { FeedEntryContract } from '@tumbu/contracts/dist/domains/feed-entry.contract';
import { BusinessType } from '@tumbu/contracts';
import { ASTParser } from './ast-parser';
import { ArtifactPlanner } from './artifact-planner';
import { ArchitecturePreChecker } from './pre-checker';
import { GeneratorAST, ArtifactPlan } from './types';

describe('ArchitecturePreChecker (TUMBU DEV-2B Stage 4)', () => {
  let validAST: GeneratorAST;
  let validPlans: ArtifactPlan[];

  beforeEach(() => {
    validAST = ASTParser.parse(FeedEntryContract);
    validPlans = ArtifactPlanner.plan(validAST);
  });

  it('should PASS a fully compliant FeedEntry AST and its planned artifacts', () => {
    const result = ArchitecturePreChecker.check(validAST, validPlans);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    
    const rules = result.rulesChecked;
    expect(rules).toHaveLength(7);
    rules.forEach(rule => {
      expect(rule.status).toBe('PASS');
    });
  });

  it('should FAIL when primary key "id" is missing in entity fields', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      entity: {
        ...validAST.entity,
        fields: validAST.entity.fields.filter(f => f.name !== 'id'),
      },
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
    
    const rule006 = result.rulesChecked.find(r => r.ruleId === 'TUMBU-ARCH-006');
    expect(rule006?.status).toBe('FAIL');
  });

  it('should FAIL when "id" type is not "uuid"', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      entity: {
        ...validAST.entity,
        fields: validAST.entity.fields.map(f => f.name === 'id' ? { ...f, type: 'string' as any } : f),
      },
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('uuid'))).toBe(true);
  });

  it('should FAIL when missing specific FeedEntry required fields like quantityKg', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      entity: {
        ...validAST.entity,
        fields: validAST.entity.fields.filter(f => f.name !== 'quantityKg'),
      },
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('quantityKg'))).toBe(true);
  });

  it('should FAIL when offline is supported but outbox sync is not supported', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      offline: {
        ...validAST.offline,
        supported: true,
      },
      sync: {
        ...validAST.sync,
        outboxSupported: false,
      },
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Outbox'))).toBe(true);
  });

  it('should FAIL when an invalid BusinessType is passed', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      applicableBusinessTypes: ['INVALID_COFFEE_SHOP' as any],
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('BusinessType'))).toBe(true);
  });

  it('should FAIL when artifact filePath leaks outside standard package/workspace boundaries', () => {
    const leakedPlans: ArtifactPlan[] = [
      ...validPlans,
      {
        filePath: 'apps/mobile/src/main.ts',
        action: 'CREATE',
        description: 'Violates boundary because apps/mobile is not in current active workspace paths',
        templateName: 'mobile-main',
      },
    ];

    const result = ArchitecturePreChecker.check(validAST, leakedPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('outside authorized workspace boundaries'))).toBe(true);
  });

  it('should FAIL when NestJS application service leaks to web client frontend apps/web/', () => {
    const leakedPlans: ArtifactPlan[] = [
      ...validPlans,
      {
        filePath: 'apps/web/src/app/bocor.service.ts',
        action: 'CREATE',
        description: 'NestJS file leaked to React frontend',
        templateName: 'nest-service',
      },
    ];

    const result = ArchitecturePreChecker.check(validAST, leakedPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('web app'))).toBe(true);
  });

  it('should FAIL when React .tsx view file leaks into NestJS API apps/api/', () => {
    const leakedPlans: ArtifactPlan[] = [
      ...validPlans,
      {
        filePath: 'apps/api/src/budidaya/api/LeakView.tsx',
        action: 'CREATE',
        description: 'React TSX file leaked to NestJS backend',
        templateName: 'react-view',
      },
    ];

    const result = ArchitecturePreChecker.check(validAST, leakedPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('NestJS API'))).toBe(true);
  });

  it('should FAIL when outbox sync is supported but idempotency key is missing or invalid', () => {
    const brokenAST: GeneratorAST = {
      ...validAST,
      sync: {
        ...validAST.sync,
        outboxSupported: true,
        idempotencyKeyField: 'missing_nonexistent_field',
      },
    };

    const result = ArchitecturePreChecker.check(brokenAST, validPlans);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Idempotency key field'))).toBe(true);
  });

  it('should not mutate the input AST or ArtifactPlans', () => {
    const originalAST = JSON.stringify(validAST);
    const originalPlans = JSON.stringify(validPlans);

    ArchitecturePreChecker.check(validAST, validPlans);

    expect(JSON.stringify(validAST)).toBe(originalAST);
    expect(JSON.stringify(validPlans)).toBe(originalPlans);
  });

  it('should perform no filesystem writes or operations', () => {
    const fs = require('fs');
    const spyWriteFile = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const spyWriteFileAsync = jest.spyOn(fs, 'writeFile').mockImplementation(() => {});

    ArchitecturePreChecker.check(validAST, validPlans);

    expect(spyWriteFile).not.toHaveBeenCalled();
    expect(spyWriteFileAsync).not.toHaveBeenCalled();

    spyWriteFile.mockRestore();
    spyWriteFileAsync.mockRestore();
  });
});
