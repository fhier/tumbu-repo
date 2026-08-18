// packages/devkit/src/generator/types.ts
import { BusinessType, DomainContract } from '@tumbu/contracts';

/**
 * Normalized Abstract Syntax Tree (AST) for the Generator.
 * Represents a parsed DomainContract in a format structured for generation.
 */
export interface GeneratorAST {
  contractName: string;
  version: string;
  cluster: string;
  applicableBusinessTypes: BusinessType[];
  entity: {
    name: string;
    description: string;
    backendPrismaModel: string;
    fields: GeneratorField[];
  };
  commands: GeneratorCommand[];
  events: GeneratorEvent[];
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
}

export interface GeneratorField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json' | 'uuid';
  required: boolean;
  description: string;
  enumOptions?: string[];
  unit?: string;
}

export interface GeneratorCommand {
  name: string;
  description: string;
  parameters: GeneratorField[];
  emitsEvent: string;
  idempotent: boolean;
}

export interface GeneratorEvent {
  name: string;
  description: string;
  payload: GeneratorField[];
  isImmutable: boolean;
}

/**
 * Planned file changes. Does NOT perform filesystem mutations.
 */
export interface ArtifactPlan {
  filePath: string;
  action: 'CREATE' | 'MODIFY' | 'APPEND';
  description: string;
  templateName: string;
  contentSnippet?: string; // Representation of proposed content or diff
}

/**
 * Result of the pre-generation architecture checks.
 */
export interface ArchitectureCheckRule {
  ruleId: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

export interface ArchitectureCheck {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rulesChecked: ArchitectureCheckRule[];
}

/**
 * The final deterministic plan containing the AST, artifact plans, and checks.
 */
export interface GeneratorPlan {
  contractName: string;
  generatorVersion: string;
  ast: GeneratorAST;
  artifacts: ArtifactPlan[]; // MUST be sorted by filePath to ensure determinism
  checks: ArchitectureCheck;
  hash: string; // Deterministic sha256 or numeric hash of canonicalized JSON
}

/**
 * Structural line in a pseudo-diff preview.
 */
export interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  text: string;
  lineNumber?: number;
}

/**
 * Dry-run preview of proposed changes.
 */
export interface DiffPreview {
  filePath: string;
  action: 'CREATE' | 'MODIFY' | 'APPEND';
  diffLines: DiffLine[];
}
