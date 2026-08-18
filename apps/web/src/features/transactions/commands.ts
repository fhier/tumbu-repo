// features/transactions/commands.ts

import { getOrCreateDeviceId } from '../../lib/offline/device';
import { getWorkspaceContext } from '../../lib/offline/workspace';
import { 
  CreateSaleCommand, 
  CreatePurchaseCommand, 
  PartnerRef 
} from '../sync/sync-types';

/**
 * Helper generator UUID v4 jika API crypto tidak tersedia
 */
function generateCommandId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Membuat payload perintah CreateSaleCommand untuk dimasukkan ke outbox
 */
export async function buildCreateSaleCommand(params: {
  clientTransactionId: string;
  partnerRef: PartnerRef;
  partnerNameSnapshot: string;
  paidAmount: number;
  account: 'CASH' | 'BANK';
  notes?: string;
  items: Array<{
    productId?: string;
    category: 'BENIH' | 'IKAN_KONSUMSI';
    species: string;
    sizeLabel: string;
    quantity: number;
    price: number;
  }>;
}): Promise<CreateSaleCommand> {
  const deviceId = await getOrCreateDeviceId();
  const context = await getWorkspaceContext();
  
  if (!context?.activeWorkspaceId) {
    throw new Error('Workspace context tidak ditemukan. Silakan login ulang.');
  }

  return {
    commandId: generateCommandId(),
    deviceId,
    localWorkspaceId: context.activeWorkspaceId,
    operation: 'CREATE',
    aggregate: 'TRANSACTION',
    payload: {
      type: 'SALE',
      clientTransactionId: params.clientTransactionId,
      partnerRef: params.partnerRef,
      partnerNameSnapshot: params.partnerNameSnapshot,
      paidAmount: params.paidAmount,
      account: params.account,
      notes: params.notes,
      clientOccurredAt: new Date().toISOString(),
      items: params.items,
    },
  };
}

/**
 * Membuat payload perintah CreatePurchaseCommand untuk dimasukkan ke outbox
 */
export async function buildCreatePurchaseCommand(params: {
  clientTransactionId: string;
  partnerRef: PartnerRef;
  partnerNameSnapshot: string;
  paidAmount: number;
  account: 'CASH' | 'BANK';
  notes?: string;
  items: Array<{
    productId?: string;
    category: 'BENIH' | 'IKAN_KONSUMSI' | 'PAKAN';
    species: string;
    sizeLabel: string;
    quantity: number;
    price: number;
  }>;
}): Promise<CreatePurchaseCommand> {
  const deviceId = await getOrCreateDeviceId();
  const context = await getWorkspaceContext();
  
  if (!context?.activeWorkspaceId) {
    throw new Error('Workspace context tidak ditemukan. Silakan login ulang.');
  }

  return {
    commandId: generateCommandId(),
    deviceId,
    localWorkspaceId: context.activeWorkspaceId,
    operation: 'CREATE',
    aggregate: 'TRANSACTION',
    payload: {
      type: 'PURCHASE',
      clientTransactionId: params.clientTransactionId,
      partnerRef: params.partnerRef,
      partnerNameSnapshot: params.partnerNameSnapshot,
      paidAmount: params.paidAmount,
      account: params.account,
      notes: params.notes,
      clientOccurredAt: new Date().toISOString(),
      items: params.items,
    },
  };
}
