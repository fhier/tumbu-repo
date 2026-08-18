// packages/devkit/src/generator/generator-plan.ts
import * as crypto from 'crypto';
import { GeneratorAST, ArtifactPlan, ArchitectureCheck, GeneratorPlan } from './types';

export class GeneratorPlanBuilder {
  private static readonly GENERATOR_VERSION = '1.0.0';

  /**
   * Bundles AST, artifact plans, and architecture checks into a single
   * deterministic GeneratorPlan, complete with a sha256 fingerprint hash.
   * This is entirely read-only, non-mutating, and dry-run only.
   */
  public static build(
    ast: GeneratorAST,
    artifacts: ArtifactPlan[],
    checks: ArchitectureCheck
  ): GeneratorPlan {
    if (!ast) {
      throw new Error('AST is null or undefined');
    }
    if (!artifacts) {
      throw new Error('Artifact plans are null or undefined');
    }
    if (!checks) {
      throw new Error('Architecture checks are null or undefined');
    }

    // Clone inputs to avoid any mutations
    const clonedAST = JSON.parse(JSON.stringify(ast)) as GeneratorAST;
    const clonedArtifacts = JSON.parse(JSON.stringify(artifacts)) as ArtifactPlan[];
    const clonedChecks = JSON.parse(JSON.stringify(checks)) as ArchitectureCheck;

    // Ensure artifacts are sorted by filePath to fulfill interface constraint and determinism
    clonedArtifacts.sort((a, b) => a.filePath.localeCompare(b.filePath));

    // Sort check elements to guarantee determinism in error order
    clonedChecks.errors.sort();
    clonedChecks.warnings.sort();
    clonedChecks.rulesChecked.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

    // Also sort AST lists to guarantee AST order-invariance
    clonedAST.applicableBusinessTypes.sort();
    clonedAST.entity.fields.sort((a, b) => a.name.localeCompare(b.name));
    clonedAST.commands.sort((a, b) => a.name.localeCompare(b.name));
    clonedAST.events.sort((a, b) => a.name.localeCompare(b.name));

    // Build the plan shell
    const plan: Omit<GeneratorPlan, 'hash'> = {
      contractName: clonedAST.contractName,
      generatorVersion: this.GENERATOR_VERSION,
      ast: clonedAST,
      artifacts: clonedArtifacts,
      checks: clonedChecks,
    };

    // Calculate deterministic hash
    const canonicalJson = this.stringifyCanonical(plan);
    const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

    return {
      ...plan,
      hash,
    };
  }

  /**
   * Stringifies any JS value into a stable canonical JSON format by sorting
   * keys of all objects alphabetically.
   */
  private static stringifyCanonical(val: any): string {
    if (val === null || val === undefined) {
      return 'null';
    }

    if (Array.isArray(val)) {
      const elements = val.map(el => this.stringifyCanonical(el));
      return `[${elements.join(',')}]`;
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val).sort();
      const properties = keys.map(
        key => `${JSON.stringify(key)}:${this.stringifyCanonical(val[key])}`
      );
      return `{${properties.join(',')}}`;
    }

    return JSON.stringify(val);
  }
}
