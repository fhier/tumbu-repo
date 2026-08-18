// features/sync/sync-push.ts

import { getPendingCommands, updateCommandStatus, archiveCommand } from './outbox';

const SYNC_API_ENDPOINT = '/api/sync/push';

/**
 * Memproses semua antrean PENDING/RETRY di outbox secara serial.
 */
export async function pushSync(): Promise<void> {
  const pendingRecords = await getPendingCommands();

  for (const record of pendingRecords) {
    try {
      // 1. Ubah status ke SYNCING sebelum mengirim HTTP request
      await updateCommandStatus(record.id, { 
        status: 'SYNCING', 
        lastAttemptAt: new Date().toISOString() 
      });

      // 2. Eksekusi Push (Hanya mengirim SyncCommand murni, BUKAN metadata record lokal)
      // Sesuai aturan: status, attempts, errorMessage, lastAttemptAt TIDAK DIKIRIM ke server!
      const response = await fetch(SYNC_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Auth header akan ditambahkan otomatis via HttpOnly Cookie atau middleware di tingkat infrastruktur.
        },
        body: JSON.stringify(record.command), // Hanya Payload murni (SyncCommand)
      });

      // 3. Evaluasi HTTP Response strict
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }

      // 4. Jika sukses (misal respons 200 OK / 201 Created)
      await updateCommandStatus(record.id, { 
        status: 'SYNCED', 
        syncedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null 
      });

      // 5. Arsipkan ke store outbox_archive untuk menjaga outbox utama tetap kecil dan cepat
      await archiveCommand(record.id);

    } catch (error) {
      // Tangani kondisi jaringan mati, endpoint belum dibuat (404), atau server crash (500)
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Jika status error adalah 400 Bad Request atau 403 Forbidden, ini indikasi kesalahan payload permanen
      // (Bukan kendala jaringan sementara), sehingga status diubah menjadi FAILED, bukan RETRY.
      const isPermanentError = errorMessage.includes('HTTP Error 400') || errorMessage.includes('HTTP Error 403');
      const nextStatus = isPermanentError ? 'FAILED' : 'RETRY';
      
      await updateCommandStatus(record.id, {
        status: nextStatus,
        attempts: record.attempts + 1,
        errorMessage: errorMessage,
      });

      console.warn(`[Push Sync] Gagal mengirim command ${record.command.commandId}. Diubah ke status ${nextStatus}. Reason: ${errorMessage}`);
      
      // Aturan Resolusi Partner Offline: Jika command teratas (misal CreatePartner) gagal diproses,
      // siklus push harus DIHENTIKAN seketika untuk mencegah hilangnya dependensi referensial 
      // dari command berikutnya (misal CreateSale yang merujuk Partner lokal).
      break; 
    }
  }
}
