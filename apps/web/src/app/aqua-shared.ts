/** Shared helpers — Budidaya UI (no Formula calc). */

export type ApiFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

export const money = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export const CYCLE_STATE_LABEL: Record<string, string> = {
  PLANNED: 'Direncanakan',
  READY: 'Siap tebar',
  ACTIVE: 'Berjalan',
  HARVESTING: 'Panen berlangsung',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const POND_STATUS_LABEL: Record<string, string> = {
  IDLE: 'Kosong',
  IN_USE: 'Terpakai',
  MAINTENANCE: 'Perawatan',
  RETIRED: 'Diarsipkan',
};

export function stateBadgeClass(state: string) {
  if (state === 'ACTIVE' || state === 'READY') return 'badge-lunas';
  if (state === 'HARVESTING' || state === 'PLANNED') return 'badge-warn';
  if (state === 'CANCELLED') return 'badge-due';
  return '';
}

export function canManageMaster(role?: string) {
  const r = String(role || '').toUpperCase();
  return r === 'OWNER' || r === 'ADMIN' || r === 'PLATFORM_ADMIN';
}

export function canOperateEvents(role?: string) {
  const r = String(role || '').toUpperCase();
  return canManageMaster(role) || r === 'STAFF';
}

export function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/** datetime-local → ISO for API eventAt */
export function toEventAt(raw: FormDataEntryValue | null | undefined) {
  const s = String(raw || '').trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
