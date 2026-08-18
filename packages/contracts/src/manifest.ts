// packages/contracts/src/manifest.ts
import { DomainContract } from './types';
import { FeedEntryContract } from './domains/feed-entry.contract';

export const REGISTERED_DOMAIN_CONTRACTS: Record<string, DomainContract> = {
  FeedEntry: FeedEntryContract,
};

export function getDomainContract(name: string): DomainContract | undefined {
  return REGISTERED_DOMAIN_CONTRACTS[name];
}

export function getAllDomainContracts(): DomainContract[] {
  return Object.values(REGISTERED_DOMAIN_CONTRACTS);
}
