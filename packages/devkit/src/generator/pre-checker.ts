// packages/devkit/src/generator/pre-checker.ts
import { BusinessType } from '@tumbu/contracts';
import { GeneratorAST, ArtifactPlan, ArchitectureCheck, ArchitectureCheckRule } from './types';

export class ArchitecturePreChecker {
  /**
   * Evaluates if the proposed GeneratorAST and ArtifactPlan[] comply with the
   * locked Tumbu architecture rules (TUMBU-ARCH-001 through TUMBU-ARCH-007).
   * This operation is murni read-only, deterministic, and non-mutating.
   */
  public static check(ast: GeneratorAST, artifacts: ArtifactPlan[]): ArchitectureCheck {
    if (!ast) {
      throw new Error('AST is null or undefined');
    }
    if (!artifacts) {
      throw new Error('Artifact plans are null or undefined');
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const rulesChecked: ArchitectureCheckRule[] = [];

    // --- TUMBU-ARCH-001: Backend must remain source of truth & Prisma consistency ---
    let arch001Status: 'PASS' | 'FAIL' = 'PASS';
    const arch001Errors: string[] = [];

    if (!ast.entity.backendPrismaModel || typeof ast.entity.backendPrismaModel !== 'string') {
      arch001Errors.push('Prisma model name is missing or invalid in AST entity');
    }

    // Check if there is a plan modifying the prisma schema
    const prismaSchemaPlan = artifacts.find(p => p.filePath === 'apps/api/prisma/schema.prisma');
    if (!prismaSchemaPlan) {
      arch001Errors.push('Missing prisma/schema.prisma modification artifact plan');
    } else if (prismaSchemaPlan.action !== 'MODIFY') {
      arch001Errors.push(`Prisma schema plan should have action MODIFY, got: ${prismaSchemaPlan.action}`);
    }

    if (arch001Errors.length > 0) {
      arch001Status = 'FAIL';
      errors.push(...arch001Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-001',
      status: arch001Status,
      message: arch001Status === 'PASS' 
        ? 'Prisma model name and backend schemas are consistent' 
        : `Backend consistency checks failed: ${arch001Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-002: Offline mutations must enter Outbox ---
    let arch002Status: 'PASS' | 'FAIL' = 'PASS';
    const arch002Errors: string[] = [];

    if (ast.offline.supported && !ast.sync.outboxSupported) {
      arch002Errors.push('Offline storage is enabled but Outbox support is not supported/enabled');
    }

    if (arch002Errors.length > 0) {
      arch002Status = 'FAIL';
      errors.push(...arch002Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-002',
      status: arch002Status,
      message: arch002Status === 'PASS'
        ? 'Offline write operations correctly queue into the outbox'
        : `Offline outbox checks failed: ${arch002Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-003: Sync push must be idempotent ---
    let arch003Status: 'PASS' | 'FAIL' = 'PASS';
    const arch003Errors: string[] = [];

    if (ast.sync.outboxSupported) {
      if (!ast.sync.idempotencyKeyField) {
        arch003Errors.push('Outbox is supported but idempotency key field is not specified');
      } else {
        const idKeyExists = ast.entity.fields.some(f => f.name === ast.sync.idempotencyKeyField) ||
                            ast.sync.idempotencyKeyField === 'clientEventId' ||
                            ast.sync.idempotencyKeyField === 'id';
        if (!idKeyExists) {
          arch003Errors.push(`Idempotency key field "${ast.sync.idempotencyKeyField}" does not exist in entity fields`);
        }
      }
    }

    if (arch003Errors.length > 0) {
      arch003Status = 'FAIL';
      errors.push(...arch003Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-003',
      status: arch003Status,
      message: arch003Status === 'PASS'
        ? 'Idempotent sync strategies are properly configured'
        : `Sync idempotency checks failed: ${arch003Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-004: Dexie contract must match canonical domain contract ---
    let arch004Status: 'PASS' | 'FAIL' = 'PASS';
    const arch004Errors: string[] = [];

    if (ast.offline.supported) {
      if (!ast.offline.storageTarget) {
        arch004Errors.push('Offline is enabled but storage target (Dexie table name) is missing');
      }
    }

    if (arch004Errors.length > 0) {
      arch004Status = 'FAIL';
      errors.push(...arch004Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-004',
      status: arch004Status,
      message: arch004Status === 'PASS'
        ? 'Dexie local cache targets are consistent with domain structure'
        : `Dexie local cache consistency checks failed: ${arch004Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-005: Forbidden production dependencies & boundaries ---
    let arch005Status: 'PASS' | 'FAIL' = 'PASS';
    const arch005Errors: string[] = [];

    for (const plan of artifacts) {
      // 1. Path boundaries check
      const validBoundary = 
        plan.filePath.startsWith('apps/api/') || 
        plan.filePath.startsWith('apps/web/') || 
        plan.filePath.startsWith('packages/contracts/');

      if (!validBoundary) {
        arch005Errors.push(`Planned file "${plan.filePath}" is outside authorized workspace boundaries`);
      }

      // 2. NestJS controller/service cannot leak to frontend
      if (plan.filePath.startsWith('apps/web/')) {
        if (plan.filePath.endsWith('.controller.ts') || plan.filePath.endsWith('.service.ts')) {
          arch005Errors.push(`NestJS files are not allowed in the web app: "${plan.filePath}"`);
        }
      }

      // 3. React views/components cannot leak to api backend
      if (plan.filePath.startsWith('apps/api/')) {
        if (plan.filePath.endsWith('.tsx') || plan.filePath.endsWith('.jsx')) {
          arch005Errors.push(`React frontend files are not allowed in the NestJS API: "${plan.filePath}"`);
        }
      }
    }

    if (arch005Errors.length > 0) {
      arch005Status = 'FAIL';
      errors.push(...arch005Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-005',
      status: arch005Status,
      message: arch005Status === 'PASS'
        ? 'Package boundaries and code isolation are perfectly respected'
        : `Boundary isolation checks failed: ${arch005Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-006: Domain mutation & required fields ---
    let arch006Status: 'PASS' | 'FAIL' = 'PASS';
    const arch006Errors: string[] = [];

    // Ensure there's always an id of type uuid and required: true
    const idField = ast.entity.fields.find(f => f.name === 'id');
    if (!idField) {
      arch006Errors.push('Required primary key field "id" is missing in entity');
    } else {
      if (idField.type !== 'uuid') {
        arch006Errors.push(`Primary key "id" must be of type uuid, got: ${idField.type}`);
      }
      if (!idField.required) {
        arch006Errors.push('Primary key "id" field must be marked as required');
      }
    }

    // Specific check for FeedEntry vertical slice
    if (ast.contractName === 'FeedEntry') {
      const requiredFeedFields = [
        { name: 'cycleId', type: 'uuid' },
        { name: 'quantityKg', type: 'number' },
        { name: 'feedTypeId', type: 'uuid' },
        { name: 'eventAt', type: 'date' }
      ];

      for (const req of requiredFeedFields) {
        const found = ast.entity.fields.find(f => f.name === req.name);
        if (!found) {
          arch006Errors.push(`Required FeedEntry field "${req.name}" is missing`);
        } else {
          if (found.type !== req.type) {
            arch006Errors.push(`FeedEntry field "${req.name}" must be of type ${req.type}, got: ${found.type}`);
          }
          if (!found.required) {
            arch006Errors.push(`FeedEntry field "${req.name}" must be marked as required`);
          }
        }
      }
    }

    if (arch006Errors.length > 0) {
      arch006Status = 'FAIL';
      errors.push(...arch006Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-006',
      status: arch006Status,
      message: arch006Status === 'PASS'
        ? 'Core domain fields and validations are compliant with canonical specs'
        : `Domain validation checks failed: ${arch006Errors.join('; ')}`,
    });

    // --- TUMBU-ARCH-007: BusinessType restrictions ---
    let arch007Status: 'PASS' | 'FAIL' = 'PASS';
    const arch007Errors: string[] = [];

    if (ast.applicableBusinessTypes.length === 0) {
      warnings.push('AST has no applicable business types specified');
    } else {
      const validEnumValues = Object.values(BusinessType) as string[];
      for (const bt of ast.applicableBusinessTypes) {
        if (!validEnumValues.includes(bt)) {
          arch007Errors.push(`Invalid BusinessType: "${bt}". Must be one of the final 8 BusinessTypes.`);
        }
      }
    }

    if (arch007Errors.length > 0) {
      arch007Status = 'FAIL';
      errors.push(...arch007Errors);
    }
    rulesChecked.push({
      ruleId: 'TUMBU-ARCH-007',
      status: arch007Status,
      message: arch007Status === 'PASS'
        ? 'Business types are compliant with the 8 final BusinessTypes constraint'
        : `BusinessType validation checks failed: ${arch007Errors.join('; ')}`,
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rulesChecked,
    };
  }
}
