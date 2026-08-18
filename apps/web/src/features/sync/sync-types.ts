// features/sync/sync-types.ts

// -----------------------------------------------------------------------------
// 1. SKEMA PENYIMPANAN LOKAL INDEXEDDB (Local Record Wrapper)
// -----------------------------------------------------------------------------

export interface LocalOutboxRecord {
  id: string; // ID baris outbox lokal (misal: outbox_1786161147843)
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'RETRY';
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
  syncedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  command: SyncCommand; // Payload perintah murni yang akan dikirim ke server
}

// -----------------------------------------------------------------------------
// 2. SKEMA PERINTAH WIRE TRANSFER (Command Sent to Server)
// -----------------------------------------------------------------------------

export type SyncCommand =
  | CreatePartnerCommand
  | CreateSaleCommand
  | CreatePurchaseCommand
  | CreateExpenseCommand
  | CreateAquaEventCommand;

export interface BaseCommand {
  commandId: string; // UUID/ULID unik sebagai kunci idempotensi di server
  deviceId: string;
  localWorkspaceId: string; // Hanya konteks lokal di HP, bukan tenantId server
  operation: 'CREATE'; // Untuk tahap awal, dimutasi offline hanya melayani CREATE
}

// Relasi Discriminated Union untuk offline & online partner reference
export type PartnerRef =
  | {
      kind: 'SERVER';
      serverPartnerId: string; // ID resmi jika partner sudah ada di database server
    }
  | {
      kind: 'LOCAL';
      clientPartnerId: string; // ID lokal jika partner baru dibuat offline di outbox HP
    };

// --- PARTNER AGGREGATE ---

export interface CreatePartnerCommand extends BaseCommand {
  aggregate: 'PARTNER';
  payload: {
    clientPartnerId: string;
    name: string;
    phone?: string;
    address?: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    clientOccurredAt: string; // Waktu pembuatan di lapangan
  };
}

// --- TRANSACTION AGGREGATE ---

export interface CreateSaleCommand extends BaseCommand {
  aggregate: 'TRANSACTION';
  payload: {
    clientTransactionId: string;
    type: 'SALE';
    partnerRef: PartnerRef; // Relasi ber-tipe discriminated union
    partnerNameSnapshot: string; // Ejaan nama partner saat input untuk arsip cetak
    paidAmount: number;
    account: 'CASH' | 'BANK';
    notes?: string;
    clientOccurredAt: string; // Waktu transaksi di lapangan (offline-safe)
    items: Array<{
      productId?: string;
      category: 'BENIH' | 'IKAN_KONSUMSI'; // Scope penjualan dibatasi benih & konsumsi
      species: string;
      sizeLabel: string;
      quantity: number;
      price: number;
      // CATATAN: Total & subtotal dihitung 100% oleh server untuk mencegah leakage
    }>;
  };
}

export interface CreatePurchaseCommand extends BaseCommand {
  aggregate: 'TRANSACTION';
  payload: {
    clientTransactionId: string;
    type: 'PURCHASE';
    partnerRef: PartnerRef;
    partnerNameSnapshot: string;
    paidAmount: number;
    account: 'CASH' | 'BANK';
    notes?: string;
    clientOccurredAt: string;
    items: Array<{
      productId?: string;
      category: 'BENIH' | 'IKAN_KONSUMSI' | 'PAKAN'; // Pembelian pakan didukung
      species: string;
      sizeLabel: string;
      quantity: number;
      price: number;
    }>;
  };
}

// --- EXPENSE AGGREGATE ---

export interface CreateExpenseCommand extends BaseCommand {
  aggregate: 'EXPENSE';
  payload: {
    clientExpenseId: string;
    category: string; // Operasional, Transportasi, Gaji, dll.
    description: string;
    amount: number;
    paymentMethod: 'CASH' | 'BANK' | 'CREDIT';
    clientOccurredAt: string;
    // Bounded Context Limit: Pada Phase 1, server hanya memproses CASH dan BANK
  };
}

// --- AQUACULTURE AGGREGATE ---

export interface CreateAquaEventCommand extends BaseCommand {
  aggregate: 'AQUA_EVENT';
  payload:
    | {
        eventType: 'FEEDING';
        cycleId: string;
        feedProductId: string;
        weightKg: number;
        clientOccurredAt: string;
      }
    | {
        eventType: 'MORTALITY';
        cycleId: string;
        quantity: number;
        clientOccurredAt: string;
      }
    | {
        eventType: 'SAMPLING';
        cycleId: string;
        averageWeightGram: number;
        clientOccurredAt: string;
      };
}
