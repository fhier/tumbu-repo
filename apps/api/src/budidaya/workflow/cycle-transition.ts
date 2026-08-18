/**
 * CultureCycle state transitions — SINGLE source of truth (WORKFLOW.md §4).
 * 8.3: semua perubahan state WAJIB lewat `assertCycleTransition` / CycleTransitionService.
 * Jangan set `state` langsung dari controller/service lain.
 */

import { BadRequestException } from '@nestjs/common';
import { CYCLE_STATES, type CycleState } from '../domain/enums';

export type CycleTransitionTrigger =
  | 'CREATE'
  | 'MARK_READY'
  | 'STOCKING_EVENT'
  | 'HARVEST_EVENT'
  | 'CLOSE_EVENT'
  | 'CANCEL';

/** Allowed edges: from → to → triggers that may fire them */
const EDGES: Array<{
  from: CycleState;
  to: CycleState;
  triggers: CycleTransitionTrigger[];
}> = [
  { from: 'PLANNED', to: 'READY', triggers: ['MARK_READY'] },
  { from: 'PLANNED', to: 'CANCELLED', triggers: ['CANCEL'] },
  { from: 'READY', to: 'ACTIVE', triggers: ['STOCKING_EVENT'] },
  { from: 'READY', to: 'CANCELLED', triggers: ['CANCEL'] },
  { from: 'ACTIVE', to: 'HARVESTING', triggers: ['HARVEST_EVENT'] },
  { from: 'ACTIVE', to: 'CLOSED', triggers: ['CLOSE_EVENT'] },
  { from: 'ACTIVE', to: 'CANCELLED', triggers: ['CANCEL'] },
  { from: 'HARVESTING', to: 'HARVESTING', triggers: ['HARVEST_EVENT'] },
  { from: 'HARVESTING', to: 'CLOSED', triggers: ['CLOSE_EVENT'] },
  { from: 'HARVESTING', to: 'CANCELLED', triggers: ['CANCEL'] },
];

const TERMINAL: ReadonlySet<CycleState> = new Set(['CLOSED', 'CANCELLED']);

/** Triggers that 8.3 public API may use (no production events yet). */
export const CYCLE_PUBLIC_TRIGGERS: ReadonlySet<CycleTransitionTrigger> = new Set([
  'MARK_READY',
  'CANCEL',
]);

export function isCycleState(value: string): value is CycleState {
  return (CYCLE_STATES as readonly string[]).includes(value);
}

export function isTerminalCycleState(state: CycleState): boolean {
  return TERMINAL.has(state);
}

/** States that count as "in use" for one-active-cycle-per-pond rule */
export function isOccupyingPondState(state: CycleState): boolean {
  return state === 'READY' || state === 'ACTIVE' || state === 'HARVESTING';
}

export function canUpdateCyclePlan(state: CycleState): boolean {
  return state === 'PLANNED' || state === 'READY';
}

export function assertCycleTransition(
  from: string,
  to: string,
  trigger: CycleTransitionTrigger,
): { from: CycleState; to: CycleState } {
  if (!isCycleState(from)) {
    throw new BadRequestException(`State siklus tidak dikenal: ${from}`);
  }
  if (!isCycleState(to)) {
    throw new BadRequestException(`State tujuan tidak dikenal: ${to}`);
  }
  if (TERMINAL.has(from)) {
    throw new BadRequestException(
      `Siklus ${from} bersifat terminal — tidak dapat diubah.`,
    );
  }
  const edge = EDGES.find((e) => e.from === from && e.to === to);
  if (!edge || !edge.triggers.includes(trigger)) {
    throw new BadRequestException(
      `Transisi ${from} → ${to} dengan pemicu ${trigger} tidak diizinkan (WORKFLOW).`,
    );
  }
  return { from, to };
}

export function listAllowedTargets(
  from: string,
  trigger?: CycleTransitionTrigger,
): CycleState[] {
  if (!isCycleState(from) || TERMINAL.has(from)) return [];
  return EDGES.filter(
    (e) => e.from === from && (!trigger || e.triggers.includes(trigger)),
  ).map((e) => e.to);
}
