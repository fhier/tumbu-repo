// packages/contracts/src/index.ts
// Core types, rules, dan domain-contract factory
export * from './types';
export * from './rules';
export * from './domain-contract';
export * from './manifest';

// ── Cluster: Hulu (CultivationContext) ──────────────────────────────
export * from './domains/cycle.contract';
export * from './domains/sampling.contract';
export * from './domains/water-quality.contract';
export * from './domains/mortality.contract';
export * from './domains/harvest.contract';
export * from './domains/feed-entry.contract';

// ── Cluster: Hilir (Supply Chain & Inventory) ────────────────────────
export * from './domains/inventory-batch.contract';
export * from './domains/order-transaction.contract';

// ── Cluster: Inti (Finance / BOP) ───────────────────────────────────
export * from './domains/expense.contract';
