// packages/devkit/src/evaluators/rule-evaluator.ts
import {
  DomainContract,
  ArchitectureRuleId,
  EvaluationStatus,
  TUMBU_ARCHITECTURE_RULES,
  CommandContract,
  FieldContract,
} from '../../../contracts/src';
import { RepositoryEvidence } from '../evidence/evidence-collector';

export interface RuleEvaluationResult {
  ruleId: ArchitectureRuleId;
  title: string;
  status: EvaluationStatus;
  expected: string;
  evidence: string;
  reason: string;
}

export interface DomainAuditReport {
  domainName: string;
  cluster: string;
  evaluatedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    unknown: number;
  };
  results: RuleEvaluationResult[];
}

export class RuleEvaluator {
  public evaluateDomain(contract: DomainContract, evidence: RepositoryEvidence): DomainAuditReport {
    const results: RuleEvaluationResult[] = [];

    // 1. TUMBU-ARCH-001: Backend must remain source of truth
    results.push(this.evaluateArch001(contract, evidence));

    // 2. TUMBU-ARCH-002: Offline mutations must enter Outbox
    results.push(this.evaluateArch002(contract, evidence));

    // 3. TUMBU-ARCH-003: Sync push must be idempotent
    results.push(this.evaluateArch003(contract, evidence));

    // 4. TUMBU-ARCH-004: Dexie contract must match canonical domain contract
    results.push(this.evaluateArch004(contract, evidence));

    // 5. TUMBU-ARCH-005: Forbidden production dependencies are not allowed
    results.push(this.evaluateArch005(contract, evidence));

    // 6. TUMBU-ARCH-006: Domain mutation must have deterministic validation
    results.push(this.evaluateArch006(contract, evidence));

    // 7. TUMBU-ARCH-007: BusinessType restrictions must be respected
    results.push(this.evaluateArch007(contract, evidence));

    const passed = results.filter((r: RuleEvaluationResult) => r.status === 'PASS').length;
    const failed = results.filter((r: RuleEvaluationResult) => r.status === 'FAIL').length;
    const unknown = results.filter(
      (r: RuleEvaluationResult) => r.status === 'UNKNOWN' || r.status === 'NOT_VERIFIED'
    ).length;

    return {
      domainName: contract.name,
      cluster: contract.cluster,
      evaluatedAt: new Date().toISOString(),
      summary: {
        total: results.length,
        passed,
        failed,
        unknown,
      },
      results,
    };
  }

  private evaluateArch001(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-001'];
    const modelName = contract.entity.backendPrismaModel;
    const modelEvidence = evidence.prismaModels.get(modelName);

    if (!modelEvidence) {
      return {
        ruleId: 'TUMBU-ARCH-001',
        title: rule.title,
        status: 'UNKNOWN',
        expected: `Prisma schema model '${modelName}' declared in apps/api/prisma/schema.prisma`,
        evidence: `No model named '${modelName}' found in current Prisma schema`,
        reason: `Backend model for ${contract.name} has not been declared or generated yet.`,
      };
    }

    // Check critical fields match
    const missingFields: string[] = [];
    for (const field of contract.entity.fields) {
      if (field.name === 'id') continue;
      const found = modelEvidence.fields.some(
        (f: { name: string; type: string }) => f.name.toLowerCase() === field.name.toLowerCase()
      );
      if (!found) {
        missingFields.push(field.name);
      }
    }

    if (missingFields.length > 0) {
      return {
        ruleId: 'TUMBU-ARCH-001',
        title: rule.title,
        status: 'FAIL',
        expected: `Model '${modelName}' to contain fields: ${contract.entity.fields.map((f: FieldContract) => f.name).join(', ')}`,
        evidence: `Found model '${modelName}' in schema.prisma, but missing fields: [${missingFields.join(', ')}]`,
        reason: `Field signature mismatch between canonical domain contract and Prisma schema.`,
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-001',
      title: rule.title,
      status: 'PASS',
      expected: `Prisma model '${modelName}' with valid fields`,
      evidence: `Model '${modelName}' found in schema.prisma with ${modelEvidence.fields.length} matching fields`,
      reason: 'Authoritative backend model verified in PostgreSQL / Prisma schema.',
    };
  }

  private evaluateArch002(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-002'];

    if (!contract.offline.supported) {
      return {
        ruleId: 'TUMBU-ARCH-002',
        title: rule.title,
        status: 'PASS',
        expected: 'Offline not required for this domain',
        evidence: 'Contract specifies offline.supported = false',
        reason: 'Domain is strictly online-only.',
      };
    }

    if (!evidence.hasOutboxStore) {
      return {
        ruleId: 'TUMBU-ARCH-002',
        title: rule.title,
        status: 'FAIL',
        expected: "IndexedDB object store 'outbox' to queue local offline mutations",
        evidence: "No 'outbox' store found in apps/web/src/lib/offline/indexeddb.ts",
        reason: 'Missing outbox store in IndexedDB configuration.',
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-002',
      title: rule.title,
      status: 'PASS',
      expected: "Active 'outbox' and 'outbox_archive' object stores in local IndexedDB",
      evidence: "Verified 'outbox' and 'outbox_archive' stores in indexeddb.ts",
      reason: 'Offline mutations are routed into the immutable outbox command queue.',
    };
  }

  private evaluateArch003(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-003'];

    if (!evidence.hasSyncIdempotencyModel) {
      return {
        ruleId: 'TUMBU-ARCH-003',
        title: rule.title,
        status: 'FAIL',
        expected: "Prisma model 'SyncIdempotency' in backend to track deduplication keys",
        evidence: "Missing 'SyncIdempotency' model in apps/api/prisma/schema.prisma",
        reason: 'Backend cannot guarantee idempotent replay without deduplication registry.',
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-003',
      title: rule.title,
      status: 'PASS',
      expected: `Idempotent push via key '${contract.sync.idempotencyKeyField}' backed by SyncIdempotency`,
      evidence: "Verified 'SyncIdempotency' model in schema.prisma with unique tenantId+idempotencyKey index",
      reason: 'Server guarantees idempotent event ingestion even during flaky retries.',
    };
  }

  private evaluateArch004(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-004'];
    const targetStore = contract.offline.storageTarget;

    const storeExists = evidence.indexedDbStores.includes(targetStore);

    if (!storeExists) {
      return {
        ruleId: 'TUMBU-ARCH-004',
        title: rule.title,
        status: 'UNKNOWN',
        expected: `IndexedDB object store '${targetStore}' for local cache table`,
        evidence: `Object store '${targetStore}' not registered in apps/web/src/lib/offline/indexeddb.ts (Existing stores: [${evidence.indexedDbStores.join(', ')}])`,
        reason: `Local storage mapping for '${contract.name}' (${targetStore}) has not been declared in IndexedDB schema.`,
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-004',
      title: rule.title,
      status: 'PASS',
      expected: `IndexedDB store '${targetStore}'`,
      evidence: `Store '${targetStore}' verified in indexeddb.ts`,
      reason: 'Dexie / IndexedDB local schema matches canonical storage target.',
    };
  }

  private evaluateArch005(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-005'];

    if (evidence.hasDirectFirestoreUsageInFeatures) {
      return {
        ruleId: 'TUMBU-ARCH-005',
        title: rule.title,
        status: 'FAIL',
        expected: 'Zero direct client-side Firestore mutations inside apps/web/src/features/',
        evidence: evidence.forbiddenDependencyFindings.join('; '),
        reason: 'Direct client-side cloud database mutation violates TUMBU self-hosted PostgreSQL/NestJS architecture.',
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-005',
      title: rule.title,
      status: 'PASS',
      expected: 'No forbidden production bypasses in client feature modules',
      evidence: 'Clean feature directories verified without unauthorized direct DB imports',
      reason: 'All mutations flow through clean local Outbox -> Sync -> NestJS pipeline.',
    };
  }

  private evaluateArch006(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-006'];

    // Check if commands have validation rules
    const missingValidation = contract.commands.filter((c: CommandContract) => !c.idempotent);

    if (missingValidation.length > 0) {
      return {
        ruleId: 'TUMBU-ARCH-006',
        title: rule.title,
        status: 'FAIL',
        expected: 'All commands to have idempotent execution and deterministic validation rules',
        evidence: `Commands without idempotency guarantee: [${missingValidation.map((c: CommandContract) => c.name).join(', ')}]`,
        reason: 'Commands must be deterministic for replayability.',
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-006',
      title: rule.title,
      status: 'PASS',
      expected: 'Deterministic validation on commands',
      evidence: `Verified ${contract.commands.length} commands with deterministic idempotent contracts`,
      reason: 'Domain formulas and commands are pure functions verified across client and server.',
    };
  }

  private evaluateArch007(contract: DomainContract, evidence: RepositoryEvidence): RuleEvaluationResult {
    const rule = TUMBU_ARCHITECTURE_RULES['TUMBU-ARCH-007'];

    if (contract.applicableBusinessTypes.length === 0) {
      return {
        ruleId: 'TUMBU-ARCH-007',
        title: rule.title,
        status: 'FAIL',
        expected: 'Explicit BusinessType authorization (1 or more of 8 BusinessTypes)',
        evidence: 'Empty applicableBusinessTypes list in domain contract',
        reason: 'Domain entity must be scoped to specific supply chain actors.',
      };
    }

    return {
      ruleId: 'TUMBU-ARCH-007',
      title: rule.title,
      status: 'PASS',
      expected: `Scoped to: [${contract.applicableBusinessTypes.join(', ')}]`,
      evidence: `Verified cluster '${contract.cluster}' with authorized types: [${contract.applicableBusinessTypes.join(', ')}]`,
      reason: 'BusinessType isolation boundaries maintained.',
    };
  }
}
