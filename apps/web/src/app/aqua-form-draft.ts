/**
 * Local draft persistence for Budidaya & Distributor Benih field forms (Doc 63 & P3 DoD).
 * Stored in localStorage; scoped per screen + tenant/workspace. Not SoT — cleared after successful save.
 */

export type AquaDraftScreen =
  | 'S02'
  | 'S03'
  | 'S04'
  | 'S05'
  | 'SURAT_JALAN'
  | 'BERITA_ACARA'
  | 'PENGELUARAN'
  | 'TX_SALE'
  | 'TX_PURCHASE';

const PREFIX = 'tumbu_aqua_draft_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DraftEnvelope<T> = {
  v: 1;
  savedAt: number;
  data: T;
};

function storageKey(screen: AquaDraftScreen, scopeId: string): string {
  return `${PREFIX}${screen}_${scopeId}`;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadAquaDraft<T>(screen: AquaDraftScreen, scopeId: string): T | null {
  if (!canUseStorage() || !scopeId) return null;
  try {
    const raw = localStorage.getItem(storageKey(screen, scopeId));
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    if (env.v !== 1 || !env.savedAt || Date.now() - env.savedAt > TTL_MS) {
      localStorage.removeItem(storageKey(screen, scopeId));
      return null;
    }
    return env.data ?? null;
  } catch {
    return null;
  }
}

export function saveAquaDraft<T>(screen: AquaDraftScreen, scopeId: string, data: T): void {
  if (!canUseStorage() || !scopeId) return;
  try {
    const env: DraftEnvelope<T> = { v: 1, savedAt: Date.now(), data };
    localStorage.setItem(storageKey(screen, scopeId), JSON.stringify(env));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearAquaDraft(screen: AquaDraftScreen, scopeId: string): void {
  if (!canUseStorage() || !scopeId) return;
  try {
    localStorage.removeItem(storageKey(screen, scopeId));
  } catch {
    /* ignore */
  }
}

/** Heuristic: fetch/network failures where retry is reasonable. */
export function isNetworkError(ex: unknown): boolean {
  if (!(ex instanceof Error)) return false;
  const msg = ex.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('koneksi') ||
    msg.includes('offline') ||
    ex.name === 'TypeError'
  );
}

export function networkDraftMessage(): string {
  return 'Koneksi terputus. Data disimpan sebagai draft lokal — coba Simpan lagi saat online.';
}
