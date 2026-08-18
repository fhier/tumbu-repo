/**
 * Pure validation helpers for Master 8.2 — no Prisma / no side effects.
 * Ensures master rules stay testable without spinning Nest.
 */
import { COST_CLASSES, METRIC_DIRECTIONS, POND_STATUSES } from '../domain/enums';

export function assertPondStatus(status: string): boolean {
  return (POND_STATUSES as readonly string[]).includes(status);
}

export function assertCostClass(costClass: string): boolean {
  return (COST_CLASSES as readonly string[]).includes(costClass);
}

export function assertMetricDirection(direction: string): boolean {
  return (METRIC_DIRECTIONS as readonly string[]).includes(direction);
}

/** Master mutations must not imply operational events — documented contract check. */
export const MASTER_NO_SIDE_EFFECT = true as const;
