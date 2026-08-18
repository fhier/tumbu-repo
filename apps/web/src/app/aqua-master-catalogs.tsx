'use client';

/**
 * Master katalog tambahan Sprint 8 — Strain · Satuan · Penyebab kematian · Supplier.
 * Supplier = reuse `/erp/partners?type=SUPPLIER` (tidak digandakan).
 * Tidak memicu Event / Formula / Cycle.
 */

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiFetch, canManageMaster } from './aqua-shared';
import { AquaMasterShell } from './aqua-master-shell';

/** Reset aman setelah await — e.currentTarget sering null pasca-async. */
function safeReset(form: HTMLFormElement | null | undefined) {
  if (form && form.isConnected) {
    try { form.reset(); } catch { /* ignore */ }
  }
}

type SpeciesOpt = { id: string; code: string; name: string };
type Strain = {
  id: string;
  code: string;
  name: string;
  speciesProfileId?: string | null;
  isActive: boolean;
  notes?: string | null;
  speciesProfile?: { code: string; name: string } | null;
};
type Unit = {
  id: string;
  code: string;
  name: string;
  symbol?: string | null;
  isActive: boolean;
  sortOrder?: number;
};
type Cause = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  notes?: string | null;
};
type Partner = { id: string; name: string; phone?: string; type: string };

export function StrainMaster({
  apiFetch,
  onNotify,
  userRole,
  allowedSpecies = [],
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  allowedSpecies?: string[];
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Strain[]>([]);
  const [species, setSpecies] = useState<SpeciesOpt[]>([]);
  const [editing, setEditing] = useState<Strain | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showInactive ? '?includeInactive=1' : '';
      const [st, sp] = await Promise.all([
        apiFetch<Strain[]>(`/budidaya/master/strains${q}`),
        apiFetch<SpeciesOpt[]>('/budidaya/master/species'),
      ]);
      setRows(st);
      setSpecies(sp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat strain.');
    }
  }, [apiFetch, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const speciesOpts = species.filter((s) => {
    if (!allowedSpecies.length) return true;
    const code = String(s.code || '').toUpperCase();
    return allowedSpecies.some((a) => code === a || code.startsWith(a) || a.startsWith(code));
  });
  const visibleRows = rows.filter((r) => {
    if (!allowedSpecies.length) return true;
    const code = String(r.speciesProfile?.code || '').toUpperCase();
    if (!code) return true;
    return allowedSpecies.some((a) => code === a || code.startsWith(a) || a.startsWith(code));
  });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = {
      code: String(f.get('code') || '').trim(),
      name: String(f.get('name') || '').trim(),
      speciesProfileId: String(f.get('speciesProfileId') || '').trim() || null,
      notes: String(f.get('notes') || '').trim() || undefined,
    };
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/budidaya/master/strains/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Varietas diperbarui.');
      } else {
        await apiFetch('/budidaya/master/strains', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onNotify?.('Varietas ditambahkan.');
      }
      await load();
      setEditing(null);
      safeReset(form);
      setFormKey((k) => k + 1);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan strain.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Jenis / Varietas Ikan</h2>
        <p className="hint">
          Katalog varietas di bawah jenis ikan. Tidak membuat siklus otomatis.
        </p>
        {can ? (
          <form
            className="form form-2"
            onSubmit={(ev) => void submit(ev)}
            key={`${editing?.id || 'new'}-${formKey}`}
          >
            <label className="field">
              <span>Kode</span>
              <input name="code" defaultValue={editing?.code || ''} required disabled={busy} placeholder="mis. SANGKURIANG" />
            </label>
            <label className="field">
              <span>Nama</span>
              <input name="name" defaultValue={editing?.name || ''} required disabled={busy} />
            </label>
            <label className="field">
              <span>Jenis ikan (opsional)</span>
              <select name="speciesProfileId" defaultValue={editing?.speciesProfileId || ''} disabled={busy}>
                <option value="">— Umum —</option>
                {speciesOpts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span>Catatan</span>
              <input name="notes" defaultValue={editing?.notes || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>
                {editing ? 'Simpan perubahan' : 'Tambah strain'}
              </button>
              {editing ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
                  Batal
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat mengubah master strain.</p>
        )}
      </section>
      <CatalogList
        title="Daftar strain"
        err={err}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
        empty="Belum ada strain."
        rows={visibleRows.map((r) => ({
          id: r.id,
          primary: r.code,
          secondary: `${r.name}${r.speciesProfile ? ` · ${r.speciesProfile.code}` : ''}`,
          status: r.isActive ? 'Aktif' : 'Nonaktif',
          active: r.isActive,
          onEdit: can && r.isActive ? () => setEditing(r) : undefined,
          onArchive:
            can && r.isActive
              ? () =>
                  void (async () => {
                    if (!confirm(`Nonaktifkan ${r.name}?`)) return;
                    setBusy(true);
                    try {
                      await apiFetch(`/budidaya/master/strains/${r.id}/deactivate`, {
                        method: 'POST',
                        body: '{}',
                      });
                      onNotify?.('Varietas dinonaktifkan.');
                      await load();
                    } catch (ex) {
                      onNotify?.(ex instanceof Error ? ex.message : 'Gagal.');
                    } finally {
                      setBusy(false);
                    }
                  })()
              : undefined,
        }))}
      />
    </>
  );
}

export function UnitMaster({
  apiFetch,
  onNotify,
  userRole,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Unit[]>([]);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showInactive ? '?includeInactive=1' : '';
      setRows(await apiFetch<Unit[]>(`/budidaya/master/units${q}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat satuan.');
    }
  }, [apiFetch, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = {
      code: String(f.get('code') || '').trim(),
      name: String(f.get('name') || '').trim(),
      symbol: String(f.get('symbol') || '').trim() || undefined,
    };
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/budidaya/master/units/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Satuan diperbarui.');
      } else {
        await apiFetch('/budidaya/master/units', { method: 'POST', body: JSON.stringify(body) });
        onNotify?.('Satuan ditambahkan.');
      }
      await load();
      setEditing(null);
      safeReset(form);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan satuan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AquaMasterShell screen="M-SATUAN" title="Satuan" lead="Referensi satuan kg, g, ekor, dan lainnya.">
        <p className="hint aqua-s02-lead">
          Jenis pakan tetap memakai teks unit — kompatibel dengan data lama.
        </p>
        {can ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await apiFetch('/budidaya/master/units/ensure-defaults', {
                      method: 'POST',
                      body: '{}',
                    });
                    onNotify?.('Satuan dasar siap.');
                    await load();
                  } catch (ex) {
                    onNotify?.(ex instanceof Error ? ex.message : 'Gagal seed satuan.');
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Isi satuan dasar
            </button>
          </div>
        ) : null}
        {can ? (
          <form className="form form-2" onSubmit={(ev) => void submit(ev)} key={editing?.id || 'new'}>
            <label className="field">
              <span>Kode</span>
              <input name="code" defaultValue={editing?.code || ''} required disabled={busy} placeholder="kg" />
            </label>
            <label className="field">
              <span>Nama</span>
              <input name="name" defaultValue={editing?.name || ''} required disabled={busy} />
            </label>
            <label className="field">
              <span>Simbol</span>
              <input name="symbol" defaultValue={editing?.symbol || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>
                {editing ? 'Simpan' : 'Tambah satuan'}
              </button>
              {editing ? (
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  Batal
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </AquaMasterShell>
      <CatalogList
        title="Daftar satuan"
        err={err}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
        empty="Belum ada satuan. Gunakan Isi satuan dasar."
        rows={rows.map((r) => ({
          id: r.id,
          primary: r.code,
          secondary: `${r.name}${r.symbol ? ` (${r.symbol})` : ''}`,
          status: r.isActive ? 'Aktif' : 'Nonaktif',
          active: r.isActive,
          onEdit: can && r.isActive ? () => setEditing(r) : undefined,
          onArchive:
            can && r.isActive
              ? () =>
                  void (async () => {
                    if (!confirm(`Nonaktifkan ${r.name}?`)) return;
                    setBusy(true);
                    try {
                      await apiFetch(`/budidaya/master/units/${r.id}/deactivate`, {
                        method: 'POST',
                        body: '{}',
                      });
                      await load();
                    } finally {
                      setBusy(false);
                    }
                  })()
              : undefined,
        }))}
      />
    </>
  );
}

export function MortalityCauseMaster({
  apiFetch,
  onNotify,
  userRole,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Cause[]>([]);
  const [editing, setEditing] = useState<Cause | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showInactive ? '?includeInactive=1' : '';
      setRows(await apiFetch<Cause[]>(`/budidaya/master/mortality-causes${q}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat penyebab.');
    }
  }, [apiFetch, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = {
      code: String(f.get('code') || '').trim(),
      name: String(f.get('name') || '').trim(),
      notes: String(f.get('notes') || '').trim() || undefined,
    };
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/budidaya/master/mortality-causes/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Penyebab diperbarui.');
      } else {
        await apiFetch('/budidaya/master/mortality-causes', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onNotify?.('Penyebab ditambahkan.');
      }
      await load();
      setEditing(null);
      safeReset(form);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AquaMasterShell
        screen="M-KEMATIAN"
        title="Penyebab Kematian / Penyakit"
        lead="Katalog label untuk catat kematian harian."
      >
        <p className="hint aqua-s02-lead">
          Event kematian tetap menyimpan catatan teks — katalog ini membantu pilihan cepat.
        </p>
        {can ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginBottom: 12 }}
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await apiFetch('/budidaya/master/mortality-causes/ensure-defaults', {
                    method: 'POST',
                    body: '{}',
                  });
                  onNotify?.('Penyebab dasar siap.');
                  await load();
                } catch (ex) {
                  onNotify?.(ex instanceof Error ? ex.message : 'Gagal.');
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Isi penyebab dasar
          </button>
        ) : null}
        {can ? (
          <form className="form form-2" onSubmit={(ev) => void submit(ev)} key={editing?.id || 'new'}>
            <label className="field">
              <span>Kode</span>
              <input name="code" defaultValue={editing?.code || ''} required disabled={busy} />
            </label>
            <label className="field">
              <span>Nama</span>
              <input name="name" defaultValue={editing?.name || ''} required disabled={busy} />
            </label>
            <label className="field full">
              <span>Catatan</span>
              <input name="notes" defaultValue={editing?.notes || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>
                {editing ? 'Simpan' : 'Tambah penyebab'}
              </button>
              {editing ? (
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  Batal
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </AquaMasterShell>
      <CatalogList
        title="Daftar penyebab"
        err={err}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
        empty="Belum ada penyebab."
        rows={rows.map((r) => ({
          id: r.id,
          primary: r.code,
          secondary: r.name,
          status: r.isActive ? 'Aktif' : 'Nonaktif',
          active: r.isActive,
          onEdit: can && r.isActive ? () => setEditing(r) : undefined,
          onArchive:
            can && r.isActive
              ? () =>
                  void (async () => {
                    if (!confirm(`Nonaktifkan ${r.name}?`)) return;
                    setBusy(true);
                    try {
                      await apiFetch(`/budidaya/master/mortality-causes/${r.id}/deactivate`, {
                        method: 'POST',
                        body: '{}',
                      });
                      await load();
                    } finally {
                      setBusy(false);
                    }
                  })()
              : undefined,
        }))}
      />
    </>
  );
}

export function SupplierMaster({
  apiFetch,
  onNotify,
  userRole,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      setRows(await apiFetch<Partner[]>('/erp/partners?type=SUPPLIER'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat supplier.');
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    try {
      await apiFetch('/erp/partners', {
        method: 'POST',
        body: JSON.stringify({
          name: String(f.get('name') || '').trim(),
          phone: String(f.get('phone') || '').trim() || undefined,
          type: 'SUPPLIER',
        }),
      });
      onNotify?.('Pemasok ditambahkan (Partner platform).');
      await load();
      safeReset(form);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan supplier.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Pemasok / Agen (Pakan & Seed)</h2>
        <p className="hint">
          Reuse Partner platform (`/erp/partners`). Tidak digandakan di domain Budidaya.
        </p>
        {can ? (
          <form className="form form-2" onSubmit={(ev) => void submit(ev)}>
            <label className="field">
              <span>Nama</span>
              <input name="name" required disabled={busy} placeholder="mis. CV Benih Jaya" />
            </label>
            <label className="field">
              <span>Telepon</span>
              <input name="phone" disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={busy}>
                Tambah pemasok
              </button>
            </div>
          </form>
        ) : null}
      </section>
      <section className="panel">
        <h2>Daftar supplier</h2>
        {err ? <p className="danger">{err}</p> : null}
        {!rows.length ? (
          <p className="empty-state">Belum ada supplier.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Nama</span>
              <span>Telepon</span>
              <span>Tipe</span>
            </div>
            {rows.map((p) => (
              <div className="tr" key={p.id}>
                <span>
                  <b>{p.name}</b>
                </span>
                <span>{p.phone || '—'}</span>
                <span>{p.type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CatalogList({
  title,
  err,
  showInactive,
  onShowInactive,
  empty,
  rows,
}: {
  title: string;
  err: string;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
  empty: string;
  rows: Array<{
    id: string;
    primary: string;
    secondary: string;
    status: string;
    active: boolean;
    onEdit?: () => void;
    onArchive?: () => void;
  }>;
}) {
  return (
    <section className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => onShowInactive(e.target.checked)}
          />
          Tampilkan nonaktif
        </label>
      </div>
      {err ? <p className="danger">{err}</p> : null}
      {!rows.length ? (
        <p className="empty-state">{empty}</p>
      ) : (
        <div className="table wide aqua-master-table">
          <div className="tr head">
            <span>Kode / Nama</span>
            <span>Status</span>
            <span>Aksi</span>
          </div>
          {rows.map((r) => (
            <div className="tr" key={r.id}>
              <span className="cell-stack">
                <b>{r.primary}</b>
                <small>{r.secondary}</small>
              </span>
              <span>{r.status}</span>
              <span className="aksi-links aksi-cols-2">
                {r.onEdit ? (
                  <button type="button" className="btn-sm" onClick={r.onEdit}>
                    Ubah
                  </button>
                ) : null}
                {r.onArchive ? (
                  <button type="button" className="btn-sm aksi-del" onClick={r.onArchive}>
                    Nonaktif
                  </button>
                ) : (
                  <span className="aksi-slot" />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
