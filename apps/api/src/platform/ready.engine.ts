// @ts-nocheck
/**
 * Ready Engine — capability/metadata driven (no blueprint ID branching).
 * Facts are collected by ReadyFactKey; rules come from BlueprintExtension.ready.
 */

import type { PrismaClient } from '@prisma/client';
import type { ReadyConfig, ReadyFactKey, ReadyRule } from './extension.types';

type Db = Pick<PrismaClient, 'pond'>;

export async function collectReadyFact(
  prisma: Db,
  workspaceId: string,
  fact: ReadyFactKey,
): Promise<number> {
  switch (fact) {
    case 'activePonds':
      return prisma.pond.count({
        where: { workspaceId, NOT: { status: 'RETIRED' } },
      });
    case 'activeSpecies':
      return 0; // removed from schema
    default:
      return 0;
  }
}

export async function collectReadyFacts(
  prisma: Db,
  tenantId: string,
  keys: ReadyFactKey[],
): Promise<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const key of keys) {
    facts[key] = await collectReadyFact(prisma, tenantId, key);
  }
  return facts;
}

export function rulePasses(rule: ReadyRule, facts: Record<string, number>): boolean {
  if (rule.type === 'always_ready') return true;
  if (rule.type === 'min_count') {
    return (facts[rule.fact] ?? 0) >= rule.min;
  }
  return true;
}

export function evaluateReady(config: ReadyConfig, facts: Record<string, number>): boolean {
  const rules = config.rules?.length ? config.rules : [{ type: 'always_ready' as const }];
  return rules.every((r) => rulePasses(r, facts));
}

export function shouldForceOnboarding(config: ReadyConfig, ready: boolean): boolean {
  return !!config.forceUntilReady && !ready;
}

