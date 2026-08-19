// packages/contracts/src/manifest.ts
import { DomainContract } from './types';
import { FeedEntryContract } from './domains/feed-entry.contract';
import { CycleContract } from './domains/cycle.contract';
import { ExpenseContract } from './domains/expense.contract';
import { HarvestContract } from './domains/harvest.contract';
import { MortalityContract } from './domains/mortality.contract';
import { SamplingContract } from './domains/sampling.contract';
import { WaterQualityContract } from './domains/water-quality.contract';
import { InventoryBatchContract } from './domains/inventory-batch.contract';
import { OrderTransactionContract } from './domains/order-transaction.contract';

export const REGISTERED_DOMAIN_CONTRACTS: Record<string, DomainContract> = {
  FeedEntry: FeedEntryContract,
  AquaCultureCycle: CycleContract,
  AquaExpenseEvent: ExpenseContract,
  AquaHarvestEvent: HarvestContract,
  AquaMortalityEvent: MortalityContract,
  AquaSamplingEvent: SamplingContract,
  AquaWaterQualityEvent: WaterQualityContract,
  InventoryBatch: InventoryBatchContract,
  OrderTransaction: OrderTransactionContract,
};

export function getDomainContract(name: string): DomainContract | undefined {
  return REGISTERED_DOMAIN_CONTRACTS[name];
}

export function getAllDomainContracts(): DomainContract[] {
  return Object.values(REGISTERED_DOMAIN_CONTRACTS);
}
