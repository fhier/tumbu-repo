// features/expenses/commands.ts

import { getOrCreateDeviceId } from '../../lib/offline/device';
import { getWorkspaceContext } from '../../lib/offline/workspace';
import { CreateExpenseCommand } from '../sync/sync-types';

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
 * Membuat payload perintah CreateExpenseCommand untuk dimasukkan ke outbox
 */
export async function buildCreateExpenseCommand(params: {
  clientExpenseId: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CREDIT';
}): Promise<CreateExpenseCommand> {
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
    aggregate: 'EXPENSE',
    payload: {
      clientExpenseId: params.clientExpenseId,
      category: params.category,
      description: params.description,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      clientOccurredAt: new Date().toISOString(),
    },
  };
}
