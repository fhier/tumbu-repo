// packages/contracts/src/rules.ts
import { ArchitectureRuleId, RuleDefinition } from './types';

export const TUMBU_ARCHITECTURE_RULES: Record<ArchitectureRuleId, RuleDefinition> = {
  'TUMBU-ARCH-001': {
    id: 'TUMBU-ARCH-001',
    title: 'Backend must remain source of truth',
    description: 'Prisma schema and NestJS backend define the authoritative persistence models and business validations.',
    severity: 'BLOCKING',
    rationale: 'Client apps (Web/Mobile) cache and queue events, but the backend arbitrates final state and financial invariants.',
  },
  'TUMBU-ARCH-002': {
    id: 'TUMBU-ARCH-002',
    title: 'Offline mutations must enter Outbox',
    description: 'Any client-side state change made while offline must produce an immutable outbox entry with clientUUID.',
    severity: 'BLOCKING',
    rationale: 'Prevents silent data loss when farmers log operations in ponds with unstable or zero connectivity.',
  },
  'TUMBU-ARCH-003': {
    id: 'TUMBU-ARCH-003',
    title: 'Sync push must be idempotent',
    description: 'Sync push requests must provide an idempotency key (clientUUID or hash) to prevent duplicate event execution on network retry.',
    severity: 'BLOCKING',
    rationale: 'Flaky network connections trigger multiple sync retries which could corrupt stock or double-count feed quantities.',
  },
  'TUMBU-ARCH-004': {
    id: 'TUMBU-ARCH-004',
    title: 'Dexie contract must match canonical domain contract',
    description: 'Local IndexedDB/Dexie table names and field definitions must strictly match canonical domain definitions.',
    severity: 'CRITICAL',
    rationale: 'Schema divergence between local cache and domain logic leads to serialization bugs and unresolvable sync conflicts.',
  },
  'TUMBU-ARCH-005': {
    id: 'TUMBU-ARCH-005',
    title: 'Forbidden production dependencies are not allowed',
    description: 'Direct production coupling to forbidden services (e.g. bypassing backend via direct client Firestore writes for core business logic) is prohibited.',
    severity: 'BLOCKING',
    rationale: 'TUMBU relies on self-hosted NestJS + PostgreSQL for multi-tenant data sovereignty and offline-first queue synchronization.',
  },
  'TUMBU-ARCH-006': {
    id: 'TUMBU-ARCH-006',
    title: 'Domain mutation must have deterministic validation',
    description: 'Formulas and domain rules (e.g. FCR, SR, Biomass, Stocking Density) must be deterministic and pure functions.',
    severity: 'CRITICAL',
    rationale: 'Enables identical validation checks to run both on offline client devices and the server verification pipeline.',
  },
  'TUMBU-ARCH-007': {
    id: 'TUMBU-ARCH-007',
    title: 'BusinessType restrictions must be respected',
    description: 'Domain entities and commands must only be exposed to and executed by authorized BusinessTypes in the supply chain.',
    severity: 'WARNING',
    rationale: 'Maintains UX clarity and data isolation across Hulu (distributors), Inti (cultivators), Hilir (offtakers), and Penunjang (logistics/lab).',
  },
};
