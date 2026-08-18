'use client';

/**
 * S14 — Pengaturan usaha Budidaya + Formula Target defaults (workspace).
 * Identity via `/erp/settings` · targets via `/budidaya/settings`.
 * Tidak mengubah Formula Engine — hanya default untuk prefill siklus.
 */

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiFetch, canManageMaster } from './aqua-shared';

type Identity = {
  name: string;
  tagline?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
};

type FormulaTargets = {
  defaultFcr: number | null;
  defaultSrPct: number | null;
  defaultDays: number | null;
  defaultWeightGram: number | null;
  defaultBopAmount: number | null;
  defaultHarvestKg: number | null;
};

type BudidayaSettings = {
  formulaTargets: FormulaTargets;
  notes: string | null;
};

export function AquaSettingsS14({
  apiFetch,
  onNotify,
  userRole,
  onRefresh,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onRefresh?: () => void;
}) {
  const can = canManageMaster(userRole);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [settings, setSettings] = useState<BudidayaSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [id, st] = await Promise.all([
        apiFetch<Identity>('/erp/settings'),
        apiFetch<BudidayaSettings>('/budidaya/settings'),
      ]);
      setIdentity(id);
      setSettings(st);
      setDirty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat pengaturan.');
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const tryLeave = (fn: () => void) => {
    if (dirty && !window.confirm('Ada perubahan belum disimpan. Buang dan lanjut?')) return;
    fn();
  };

  const saveIdentity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await apiFetch('/erp/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(f.get('name') || '').trim(),
          tagline: String(f.get('tagline') || '').trim(),
          phone: String(f.get('phone') || '').trim(),
          address: String(f.get('address') || '').trim(),
          logoUrl: String(f.get('logoUrl') || '').trim(),
        }),
      });
      onNotify?.('Identitas usaha disimpan.');
      setDirty(false);
      onRefresh?.();
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan identitas.');
    } finally {
      setBusy(false);
    }
  };

  const saveTargets = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const f = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = String(f.get(k) || '').trim();
      return v ? Number(v) : null;
    };
    setBusy(true);
    try {
      await apiFetch('/budidaya/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          notes: String(f.get('notes') || '').trim() || null,
          formulaTargets: {
            defaultFcr: num('defaultFcr'),
            defaultSrPct: num('defaultSrPct'),
            defaultDays: num('defaultDays'),
            defaultWeightGram: num('defaultWeightGram'),
            defaultBopAmount: num('defaultBopAmount'),
            defaultHarvestKg: num('defaultHarvestKg'),
          },
        }),
      });
      onNotify?.('Rencana target default workspace disimpan.');
      setDirty(false);
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan target.');
    } finally {
      setBusy(false);
    }
  };

  if (err && !identity) {
    return (
      <p className="empty-state">
        {err}{' '}
        <button type="button" className="tl-btn" onClick={() => void load()}>
          Coba lagi
        </button>
      </p>
    );
  }

  if (!identity || !settings) {
    return <p className="empty-state">Memuat pengaturan…</p>;
  }

  const ft = settings.formulaTargets;

  return (
    <>
      <section className="panel aqua-s02" data-screen="S14">
        <div className="aqua-s02-top">
          <div className="aqua-s02-who">Pengaturan usaha</div>
          <div className="aqua-s02-sub">Identitas — tanpa CTA tebar/pakan</div>
        </div>
        <h2 className="aqua-s02-title">Identitas workspace</h2>
        <p className="hint aqua-s02-lead">
          Nama, tagline, logo. Safe Exit jika ada perubahan belum disimpan.
        </p>
        {can ? (
          <form
            className="form form-2"
            onSubmit={(ev) => void saveIdentity(ev)}
            onChange={() => setDirty(true)}
          >
            <label className="field">
              <span>Nama usaha</span>
              <input name="name" defaultValue={identity.name || ''} required disabled={busy} />
            </label>
            <label className="field">
              <span>Tagline</span>
              <input name="tagline" defaultValue={identity.tagline || ''} disabled={busy} />
            </label>
            <label className="field">
              <span>Telepon</span>
              <input name="phone" defaultValue={identity.phone || ''} disabled={busy} />
            </label>
            <label className="field">
              <span>Alamat</span>
              <input name="address" defaultValue={identity.address || ''} disabled={busy} />
            </label>
            <label className="field full">
              <span>URL logo</span>
              <input name="logoUrl" defaultValue={identity.logoUrl || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>
                Simpan identitas
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => tryLeave(() => void load())}
              >
                Batalkan perubahan
              </button>
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat mengubah pengaturan.</p>
        )}
      </section>

      <section className="panel">
        <h2>Rencana Target Default</h2>
        <p className="hint">
          Nilai awal saat membuat siklus baru. KPI operasional tetap dihitung dari catatan harian.
        </p>
        {can ? (
          <form
            className="form form-2"
            key={JSON.stringify(ft)}
            onSubmit={(ev) => void saveTargets(ev)}
            onChange={() => setDirty(true)}
          >
            <label className="field">
              <span>Target FCR</span>
              <input
                name="defaultFcr"
                type="number"
                min={0}
                step="any"
                defaultValue={ft.defaultFcr ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Target SR (%)</span>
              <input
                name="defaultSrPct"
                type="number"
                min={0}
                max={100}
                step="any"
                defaultValue={ft.defaultSrPct ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Target hari</span>
              <input
                name="defaultDays"
                type="number"
                min={0}
                defaultValue={ft.defaultDays ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Target berat (gram)</span>
              <input
                name="defaultWeightGram"
                type="number"
                min={0}
                step="any"
                defaultValue={ft.defaultWeightGram ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Target BOP (Rp)</span>
              <input
                name="defaultBopAmount"
                type="number"
                min={0}
                step="any"
                defaultValue={ft.defaultBopAmount ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Target panen (kg)</span>
              <input
                name="defaultHarvestKg"
                type="number"
                min={0}
                step="any"
                defaultValue={ft.defaultHarvestKg ?? ''}
                disabled={busy}
              />
            </label>
            <label className="field full">
              <span>Catatan</span>
              <input name="notes" defaultValue={settings.notes || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={busy}>
                Simpan target default
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel" style={{ marginTop: '2rem', border: '1px solid #ff4444' }}>
        <h2 style={{ color: '#ff4444' }}>Data Management</h2>
        <p className="hint">Reset data operasional (Purchase, Sale, Stock, Cash, Reports).</p>
        <button
          className="btn-secondary"
          style={{ borderColor: '#ff4444', color: '#ff4444' }}
          disabled={busy}
          onClick={async () => {
            const confirm = window.prompt('Data operasional akan dihapus permanen. Ketik "RESET" untuk konfirmasi:');
            if (confirm === 'RESET') {
              setBusy(true);
              try {
                await apiFetch('/clear-workspace', { method: 'POST' });
                onNotify?.('Berhasil reset data operasional.');
                onRefresh?.();
              } catch (ex) {
                onNotify?.('Gagal reset: ' + (ex instanceof Error ? ex.message : String(ex)));
              } finally {
                setBusy(false);
              }
            } else if (confirm !== null) {
              onNotify?.('Konfirmasi salah.');
            }
          }}
        >
          Clear Workspace Data
        </button>
      </section>
    </>
  );
}
