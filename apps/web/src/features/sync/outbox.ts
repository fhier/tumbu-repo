// features/sync/outbox.ts

import { localDb, STORES } from '../../lib/offline/indexeddb';
import { LocalOutboxRecord, SyncCommand } from './sync-types';

const STORE_OUTBOX = STORES.OUTBOX;
const STORE_ARCHIVE = STORES.OUTBOX_ARCHIVE;

/**
 * Menambahkan command baru ke antrean outbox lokal dengan status PENDING
 */
export async function addToOutbox(command: SyncCommand): Promise<void> {
  const record: LocalOutboxRecord = {
    id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    syncedAt: null,
    errorCode: null,
    errorMessage: null,
    command,
  };

  await localDb.put<LocalOutboxRecord>(STORE_OUTBOX, record);
}

/**
 * Mengambil semua record dari outbox, lalu memfilter yang berstatus PENDING atau RETRY.
 * Diurutkan berdasarkan createdAt (FIFO).
 */
export async function getPendingCommands(): Promise<LocalOutboxRecord[]> {
  const allRecords = await localDb.getAll<LocalOutboxRecord>(STORE_OUTBOX);
  
  return allRecords
    .filter(r => r.status === 'PENDING' || r.status === 'RETRY')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Memperbarui status dan metadata suatu record outbox (misalnya saat SYNCING atau FAILED)
 */
export async function updateCommandStatus(id: string, updates: Partial<LocalOutboxRecord>): Promise<void> {
  const record = await localDb.get<LocalOutboxRecord>(STORE_OUTBOX, id);
  if (!record) {
    throw new Error(`Outbox record dengan id ${id} tidak ditemukan`);
  }

  const updatedRecord = { ...record, ...updates };
  await localDb.put<LocalOutboxRecord>(STORE_OUTBOX, updatedRecord);
}

/**
 * Memindahkan record yang sudah berstatus SYNCED dari tabel outbox aktif ke outbox_archive.
 */
export async function archiveCommand(id: string): Promise<void> {
  const record = await localDb.get<LocalOutboxRecord>(STORE_OUTBOX, id);
  if (!record) {
    throw new Error(`Outbox record dengan id ${id} tidak ditemukan untuk diarsipkan`);
  }

  // Pindahkan ke store archive
  await localDb.put<LocalOutboxRecord>(STORE_ARCHIVE, record);
  
  // Hapus dari store aktif
  await localDb.delete(STORE_OUTBOX, id);
}
