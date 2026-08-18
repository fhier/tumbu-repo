// packages/contracts/src/domain-contract.ts
import { DomainContract } from './types';

export function defineDomainContract(contract: DomainContract): Readonly<DomainContract> {
  return Object.freeze(contract);
}
