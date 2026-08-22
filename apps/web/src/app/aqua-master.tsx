'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiFetch,
  POND_STATUS_LABEL,
  canManageMaster,
} from './aqua-shared';
import {
  MortalityCauseMaster,
  UnitMaster,
} from './aqua-master-catalogs';
import { CommodityCatalog } from './aqua-commodity-catalog';
import { filterByAllowedSpecies } from './filter-context';
import { computePondVolume, type PondShape } from './aqua-pond-volume';
import { PondVolumeFields } from './aqua-pond-volume-fields';
import { AquaMasterShell } from './aqua-master-shell';
import {
  canCreatePond,
  PLAN_UPGRADE_MESSAGES,
  resolvePlanLimits,
  type PlanFeatureLimits,
} from '@tumbu/core';
import {
  FEED_CATALOG_2026,
  calcBagsNeeded,
  feedPresetsForSpecies,
  formatBagCalc,
  suggestPelletStage,
  type FeedPreset2026,
} from './aqua-feed-catalog-2026';

type Pond = {
  id: string;
  code: string;
  name: string;
  areaM2?: number | string | null;
  volumeM3?: number | string | null;
  location?: string | null;
  systemType?: string | null;
  status: string;
  notes?: string | null;
};

type Species = {
  id: string;
  code: string;
  name: string;
  typicalDays?: number | null;
  typicalFcr?: number | string | null;
  typicalSrPct?: number | string | null;
  isActive: boolean;
  notes?: string | null;
};

type FeedType = {
  id: string;
  name: string;
  brand?: string | null;
  proteinPct?: number | string | null;
  unit: string;
  defaultPrice?: number | string | null;
  isActive: boolean;
};

export type AquaMasterTab =
  | 'kolam'
  | 'komoditas'
  | 'pakan'
  | 'supplier'
  | 'satuan'
  | 'kematian'
  | 'targets';

export function AquaMasterPage({
  tab,
  apiFetch,
  onNotify,
  userRole,
  onNavigate,
  allowedSpecies = [],
  planLimits,
}: {
  tab: AquaMasterTab;
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onNavigate?: (key: string) => void;
  allowedSpecies?: string[];
  planLimits?: PlanFeatureLimits;
}) {
  const limits = planLimits || resolvePlanLimits('starter');
  if (tab === 'kolam') {
    return (
      <PondMaster
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        onNavigate={onNavigate}
        planLimits={limits}
      />
    );
  }
  if (tab === 'komoditas') {
    return (
      <CommodityCatalog
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        allowedSpecies={allowedSpecies}
      />
    );
  }
  if (tab === 'supplier') {
    return (
      <section className="panel">
        <h2>Pemasok / Agen</h2>
        <p className="hint">
          Menu pemasok sementara dinonaktifkan agar rekomendasi pakan tetap netral dan tidak menimbulkan bias.
          Kelola jenis pakan langsung di <b>Jenis pakan</b> dengan katalog preset 2026.
        </p>
      </section>
    );
  }
  if (tab === 'satuan') {
    return <UnitMaster apiFetch={apiFetch} onNotify={onNotify} userRole={userRole} />;
  }
  if (tab === 'kematian') {
    return <MortalityCauseMaster apiFetch={apiFetch} onNotify={onNotify} userRole={userRole} />;
  }
  if (tab === 'targets') {
    return null; // routed via AquaSettingsS14 formula section / pengaturan
  }
  return <FeedTypeMaster apiFetch={apiFetch} onNotify={onNotify} userRole={userRole} />;
}

type PondSystemOpt = { code: string; label: string; hint?: string };

function PondMaster({
  apiFetch,
  onNotify,
  userRole,
  onNavigate,
  planLimits,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onNavigate?: (key: string) => void;
  planLimits: PlanFeatureLimits;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Pond[]>([]);
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<Pond | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pondFormKey, setPondFormKey] = useState(0);
  const [pondSystems, setPondSystems] = useState<PondSystemOpt[]>([]);
  const [pondShape, setPondShape] = useState<PondShape>('box');
  const [lengthM, setLengthM] = useState<number | ''>('');
  const [widthM, setWidthM] = useState<number | ''>('');
  const [diameterM, setDiameterM] = useState<number | ''>('');
  const [depthM, setDepthM] = useState<number | ''>('');
  const dims = computePondVolume({
    shape: pondShape,
    lengthM,
    widthM,
    diameterM,
    depthM,
  });

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showRetired ? '?includeRetired=1' : '';
      const [ponds, systems] = await Promise.all([
        apiFetch<Pond[]>(`/budidaya/master/ponds${q}`),
        apiFetch<PondSystemOpt[]>('/budidaya/master/catalog/pond-systems').catch(() => []),
      ]);
      setRows(ponds);
      setPondSystems(systems);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat kolam.');
    }
  }, [apiFetch, showRetired]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (editing) {
      setPondShape('box');
      setLengthM('');
      setWidthM('');
      setDiameterM('');
      setDepthM('');
    }
  }, [editing?.id]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    if (!editing) {
      const activeCount = rows.filter((p) => p.status !== 'RETIRED').length;
      if (!canCreatePond(planLimits, activeCount)) {
        onNotify?.(PLAN_UPGRADE_MESSAGES.pondQuota);
        return;
      }
    }
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(f.get('name') || '').trim(),
      location: String(f.get('location') || '').trim() || undefined,
      systemType: String(f.get('systemType') || '').trim() || undefined,
      status: String(f.get('status') || 'IDLE'),
      notes: String(f.get('notes') || '').trim() || undefined,
    };
    const code = String(f.get('code') || '').trim();
    if (code) body.code = code;
    if (pondShape === 'box' && lengthM !== '' && widthM !== '') {
      body.lengthM = Number(lengthM);
      body.widthM = Number(widthM);
      if (depthM !== '') body.depthM = Number(depthM);
    } else if (pondShape === 'round' && diameterM !== '') {
      body.diameterM = Number(diameterM);
      if (depthM !== '') body.depthM = Number(depthM);
    }
    if (dims.volumeM3 != null) body.volumeM3 = dims.volumeM3;
    else if (dims.areaM2 != null && !body.lengthM) body.areaM2 = dims.areaM2;
    else {
      if (f.get('areaM2')) body.areaM2 = Number(f.get('areaM2'));
      if (f.get('volumeM3')) body.volumeM3 = Number(f.get('volumeM3'));
    }
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/budidaya/master/ponds/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Wadah diperbarui.');
      } else {
        await apiFetch('/budidaya/master/ponds', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onNotify?.('Wadah ditambahkan.');
      }
      setEditing(null);
      setPondShape('box');
      setLengthM('');
      setWidthM('');
      setDiameterM('');
      setDepthM('');
      setPondFormKey((k) => k + 1);
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan kolam.');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (p: Pond) => {
    if (!can || !confirm(`Arsipkan kolam ${p.name}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/budidaya/master/ponds/${p.id}/deactivate`, { method: 'POST', body: '{}' });
      onNotify?.('Kolam diarsipkan.');
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal mengarsipkan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AquaMasterShell
        screen="M-KOLAM"
        title="Wadah Budidaya"
        lead="Kelola kolam, ember, atau terpal tempat siklus berjalan."
      >
        <p className="hint aqua-s02-lead">
          Pilih bentuk kolam (<b>Kotak</b> atau <b>Bundar/Bioflok</b>) — volume air dihitung otomatis.
          <b> Tambah wadah ≠ buat siklus</b> — lanjut dari menu Siklus Tebar.
        </p>
        {onNavigate ? (
          <p style={{ marginTop: 0 }}>
            <button type="button" className="tl-btn tl-btn-primary" onClick={() => onNavigate('siklus')}>
              Lanjut mulai siklus
            </button>
          </p>
        ) : null}
        {can ? (
          <form className="form form-2" onSubmit={submit} key={editing?.id || `new-${pondFormKey}`}>
            <label className="field">
              <span>Kode {editing ? '' : '(otomatis jika kosong)'}</span>
              <input
                name="code"
                defaultValue={editing?.code || ''}
                required={!!editing}
                disabled={busy}
                placeholder={editing ? 'mis. WDH-001' : 'Kosongkan = WDH-001 otomatis'}
              />
            </label>
            <label className="field">
              <span>Nama wadah</span>
              <input name="name" defaultValue={editing?.name || ''} required disabled={busy} placeholder='mis. "Ember Lele 01"' />
            </label>
            <PondVolumeFields
              shape={pondShape}
              onShapeChange={setPondShape}
              lengthM={lengthM}
              widthM={widthM}
              diameterM={diameterM}
              depthM={depthM}
              onLengthChange={setLengthM}
              onWidthChange={setWidthM}
              onDiameterChange={setDiameterM}
              onDepthChange={setDepthM}
              disabled={busy}
            />
            <label className="field">
              <span>Luas (m²)</span>
              <input
                name="areaM2"
                type="number"
                min={0}
                step="any"
                readOnly={dims.areaM2 != null}
                defaultValue={
                  dims.areaM2 != null
                    ? String(dims.areaM2)
                    : editing?.areaM2 != null
                      ? String(editing.areaM2)
                      : ''
                }
                key={`area-${dims.areaM2 ?? editing?.id ?? 'new'}`}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Volume (m³)</span>
              <input
                name="volumeM3"
                type="number"
                min={0}
                step="any"
                readOnly={dims.volumeM3 != null}
                defaultValue={
                  dims.volumeM3 != null
                    ? String(dims.volumeM3)
                    : editing?.volumeM3 != null
                      ? String(editing.volumeM3)
                      : ''
                }
                key={`vol-${dims.volumeM3 ?? editing?.id ?? 'new'}`}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Lokasi</span>
              <input name="location" defaultValue={editing?.location || ''} disabled={busy} />
            </label>
            <label className="field">
              <span>Sistem kolam</span>
              <select name="systemType" defaultValue={editing?.systemType || ''} disabled={busy}>
                <option value="">— Pilih —</option>
                {pondSystems.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={editing?.status || 'IDLE'} disabled={busy}>
                <option value="IDLE">Kosong</option>
                <option value="IN_USE">Terpakai</option>
                <option value="MAINTENANCE">Perawatan</option>
              </select>
            </label>
            <label className="field full">
              <span>Catatan</span>
              <input name="notes" defaultValue={editing?.notes || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" disabled={busy}>{editing ? 'Simpan perubahan' : 'Tambah kolam'}</button>
              {editing ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Batal</button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat mengubah master kolam.</p>
        )}
      </AquaMasterShell>

      <section className="panel aqua-master-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, border: 0 }}>Daftar kolam</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            Tampilkan arsip
          </label>
        </div>
        {err ? <p className="danger">{err}</p> : null}
        {!rows.length ? (
          <p className="empty-state">Belum ada kolam. Tambahkan kolam pertama di atas.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Kode / Nama</span>
              <span>Status</span>
              <span>Ukuran</span>
              <span>Aksi</span>
            </div>
            {rows.map((p) => (
              <div className="tr" key={p.id}>
                <span className="cell-stack">
                  <b>{p.code}</b>
                  <small>{p.name}{p.location ? ` · ${p.location}` : ''}</small>
                </span>
                <span>{POND_STATUS_LABEL[p.status] || p.status}</span>
                <span>
                  {p.areaM2 != null ? `${p.areaM2} m²` : '—'}
                  {p.volumeM3 != null ? ` · ${p.volumeM3} m³` : ''}
                </span>
                <span className="aksi-links aksi-cols-2">
                  {can && p.status !== 'RETIRED' ? (
                    <>
                      <button type="button" className="btn-sm" disabled={busy} onClick={() => setEditing(p)}>Ubah</button>
                      <button type="button" className="btn-sm aksi-del" disabled={busy} onClick={() => void archive(p)}>Arsip</button>
                    </>
                  ) : (
                    <span className="aksi-slot" />
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

type SpeciesCatalogEntry = {
  code: string;
  name: string;
  typicalDays: number;
  typicalFcr: number;
  typicalSrPct: number;
  notes: string;
};

function SpeciesMaster({
  apiFetch,
  onNotify,
  userRole,
  onNavigate,
  allowedSpecies = [],
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onNavigate?: (key: string) => void;
  allowedSpecies?: string[];
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<Species[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Species | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [catalog, setCatalog] = useState<SpeciesCatalogEntry[]>([]);
  const [pickCode, setPickCode] = useState('');
  const [guidance, setGuidance] = useState('');
  const [speciesFormKey, setSpeciesFormKey] = useState(0);

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showInactive ? '?includeInactive=1' : '';
      const [species, cat] = await Promise.all([
        apiFetch<Species[]>(`/budidaya/master/species${q}`),
        apiFetch<SpeciesCatalogEntry[]>('/budidaya/master/catalog/species').catch(() => []),
      ]);
      setRows(species);
      setCatalog(cat);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat jenis ikan.');
    }
  }, [apiFetch, showInactive]);

  const loadDefaults = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await apiFetch('/budidaya/master/species/ensure-defaults', { method: 'POST', body: '{}' });
      onNotify?.('Katalog jenis ikan air tawar Indonesia dimuat.');
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal memuat katalog.');
    } finally {
      setBusy(false);
    }
  };

  const applyCatalogPick = (code: string) => {
    setPickCode(code);
    const hit = catalog.find((c) => c.code === code);
    if (!hit) {
      setGuidance('');
      return;
    }
    setGuidance(hit.notes);
    setEditing({
      id: '',
      code: hit.code,
      name: hit.name,
      typicalDays: hit.typicalDays,
      typicalFcr: hit.typicalFcr,
      typicalSrPct: hit.typicalSrPct,
      notes: hit.notes,
      isActive: true,
    });
  };

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(
    () => filterByAllowedSpecies(rows, allowedSpecies, (s) => s.code || s.name),
    [rows, allowedSpecies],
  );
  const visibleCatalog = useMemo(
    () => filterByAllowedSpecies(catalog, allowedSpecies, (c) => c.code || c.name),
    [catalog, allowedSpecies],
  );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const f = new FormData(e.currentTarget);
    const body = {
      code: String(f.get('code') || '').trim(),
      name: String(f.get('name') || '').trim(),
      typicalDays: f.get('typicalDays') ? Number(f.get('typicalDays')) : undefined,
      typicalFcr: f.get('typicalFcr') ? Number(f.get('typicalFcr')) : undefined,
      typicalSrPct: f.get('typicalSrPct') ? Number(f.get('typicalSrPct')) : undefined,
      notes: String(f.get('notes') || '').trim() || undefined,
      isActive: true,
    };
    setBusy(true);
    try {
      if (editing?.id) {
        await apiFetch(`/budidaya/master/species/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Jenis ikan diperbarui.');
      } else {
        await apiFetch('/budidaya/master/species', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onNotify?.('Jenis ikan ditambahkan.');
      }
      setEditing(null);
      setPickCode('');
      setGuidance('');
      setSpeciesFormKey((k) => k + 1);
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (s: Species) => {
    if (!can || !confirm(`Nonaktifkan ${s.name}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/budidaya/master/species/${s.id}/deactivate`, { method: 'POST', body: '{}' });
      onNotify?.('Jenis ikan dinonaktifkan.');
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menonaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AquaMasterShell
        screen="M-SPECIES"
        title="Jenis Ikan"
        lead="Katalog komoditas air tawar — FCR/SR tipikal terisi otomatis."
      >
        <p className="hint aqua-s02-lead">
          Pilih dari katalog air tawar Indonesia. Tumbu memperingatkan jika target menyimpang dari referensi budidaya.
        </p>
        {can ? (
          <p style={{ marginTop: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="tl-btn tl-btn-primary" disabled={busy} onClick={() => void loadDefaults()}>
              Muat jenis ikan umum
            </button>
          </p>
        ) : null}
        {onNavigate && rows.some((r) => r.isActive) ? (
          <p style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onNotify?.('Lewati — lanjut ke siklus.');
                onNavigate('siklus');
              }}
            >
              Lewati — lanjut siklus
            </button>
          </p>
        ) : null}
        {can ? (
          <form className="form form-2" onSubmit={submit} key={editing?.id || `new-${speciesFormKey}`}>
            {!editing?.id ? (
              <label className="field full">
                <span>Pilih dari katalog</span>
                <select
                  value={pickCode}
                  disabled={busy}
                  onChange={(ev) => applyCatalogPick(ev.target.value)}
                >
                  <option value="">— Manual / pilih katalog —</option>
                  {visibleCatalog.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {guidance ? (
              <p className="hint full" style={{ gridColumn: '1 / -1', margin: 0 }}>
                {guidance}
              </p>
            ) : null}
            <label className="field">
              <span>Kode</span>
              <input name="code" defaultValue={editing?.code || ''} required disabled={busy} placeholder="mis. NILA" />
            </label>
            <label className="field">
              <span>Nama</span>
              <input name="name" defaultValue={editing?.name || ''} required disabled={busy} placeholder="mis. Nila" />
            </label>
            <label className="field">
              <span>Lama siklus tipikal (hari)</span>
              <input name="typicalDays" type="number" min={0} defaultValue={editing?.typicalDays ?? ''} disabled={busy} />
            </label>
            <label className="field">
              <span>FCR tipikal</span>
              <input name="typicalFcr" type="number" min={0} step="any" defaultValue={editing?.typicalFcr != null ? String(editing.typicalFcr) : ''} disabled={busy} />
            </label>
            <label className="field">
              <span>SR tipikal (%)</span>
              <input name="typicalSrPct" type="number" min={0} max={100} step="any" defaultValue={editing?.typicalSrPct != null ? String(editing.typicalSrPct) : ''} disabled={busy} />
            </label>
            <label className="field full">
              <span>Catatan</span>
              <input name="notes" defaultValue={editing?.notes || ''} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>{editing ? 'Simpan perubahan' : 'Tambah jenis ikan'}</button>
              {editing ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setEditing(null); setPickCode(''); setGuidance(''); }}>Batal</button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat mengubah master spesies.</p>
        )}
      </AquaMasterShell>

      <section className="panel aqua-master-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, border: 0 }}>Daftar jenis ikan</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Tampilkan nonaktif
          </label>
        </div>
        {err ? <p className="danger">{err}</p> : null}
        {!rows.length ? (
          <p className="empty-state">Belum ada jenis ikan.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Kode / Nama</span>
              <span>Status</span>
              <span>Tipikal</span>
              <span>Aksi</span>
            </div>
            {visibleRows.map((s) => (
              <div className="tr" key={s.id}>
                <span className="cell-stack">
                  <b>{s.code}</b>
                  <small>{s.name}</small>
                </span>
                <span>{s.isActive ? 'Aktif' : 'Nonaktif'}</span>
                <span>
                  {s.typicalDays != null ? `${s.typicalDays} hari` : '—'}
                  {s.typicalFcr != null ? ` · FCR ${s.typicalFcr}` : ''}
                </span>
                <span className="aksi-links aksi-cols-2">
                  {can && s.isActive ? (
                    <>
                      <button type="button" className="btn-sm" disabled={busy} onClick={() => setEditing(s)}>Ubah</button>
                      <button type="button" className="btn-sm aksi-del" disabled={busy} onClick={() => void archive(s)}>Nonaktif</button>
                    </>
                  ) : (
                    <span className="aksi-slot" />
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FeedTypeMaster({
  apiFetch,
  onNotify,
  userRole,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<FeedType[]>([]);
  const [units, setUnits] = useState<Array<{ code: string; name: string }>>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<FeedType | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [presetPick, setPresetPick] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [needKg, setNeedKg] = useState<number | ''>('');
  const [bagSize, setBagSize] = useState<number>(20);
  const [fishWeightG, setFishWeightG] = useState<number | ''>('');
  const [feedFormKey, setFeedFormKey] = useState(0);
  const [feedName, setFeedName] = useState('');
  const [feedBrand, setFeedBrand] = useState('');
  const [feedProtein, setFeedProtein] = useState('');
  const [feedUnit, setFeedUnit] = useState('kg');
  const [feedPrice, setFeedPrice] = useState('');

  const presets = useMemo(
    () => (speciesFilter.trim() ? feedPresetsForSpecies(speciesFilter) : FEED_CATALOG_2026),
    [speciesFilter],
  );
  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === presetPick) || presets[0] || null,
    [presets, presetPick],
  );
  const pelletHint = useMemo(() => {
    if (!selectedPreset) return null;
    const w = typeof fishWeightG === 'number' ? fishWeightG : Number(fishWeightG);
    return suggestPelletStage(selectedPreset, w);
  }, [selectedPreset, fishWeightG]);
  const bagCalc = useMemo(() => {
    const kg = typeof needKg === 'number' ? needKg : Number(needKg);
    return calcBagsNeeded(kg, bagSize);
  }, [needKg, bagSize]);

  const applyPreset = (preset: FeedPreset2026, stageCode?: string) => {
    const stage = stageCode
      ? preset.pelletStages.find((s) => s.code === stageCode) || preset.pelletStages[0]
      : preset.pelletStages[0];
    const name = stage ? `${preset.productLine} ${stage.code}` : preset.productLine;
    const price = Math.round(preset.pricePerKg2026 * (preset.bagSizesKg[0] || 20));
    setEditing(null);
    setPresetPick(preset.id);
    setFeedName(name);
    setFeedBrand(preset.brand);
    setFeedProtein(preset.proteinPct != null ? String(preset.proteinPct) : '');
    setFeedPrice(String(price));
    setFeedUnit('kg');
    onNotify?.(`Preset ${preset.brand} ${name} — lengkapi form lalu simpan.`);
  };

  const resetFeedForm = () => {
    setEditing(null);
    setFeedName('');
    setFeedBrand('');
    setFeedProtein('');
    setFeedUnit('kg');
    setFeedPrice('');
    setFeedFormKey((k) => k + 1);
  };

  const load = useCallback(async () => {
    setErr('');
    try {
      const q = showInactive ? '?includeInactive=1' : '';
      const [ft, u] = await Promise.all([
        apiFetch<FeedType[]>(`/budidaya/master/feed-types${q}`),
        apiFetch<Array<{ code: string; name: string }>>('/budidaya/master/units').catch(() => []),
      ]);
      setRows(ft);
      setUnits(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat jenis pakan.');
    }
  }, [apiFetch, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can) return;
    const body = {
      name: feedName.trim(),
      brand: feedBrand.trim() || undefined,
      proteinPct: feedProtein ? Number(feedProtein) : undefined,
      unit: feedUnit.trim() || 'kg',
      defaultPrice: feedPrice ? Number(feedPrice) : undefined,
    };
    if (!body.name) {
      onNotify?.('Nama pakan wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/budidaya/master/feed-types/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onNotify?.('Jenis pakan diperbarui.');
      } else {
        await apiFetch('/budidaya/master/feed-types', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onNotify?.('Jenis pakan ditambahkan.');
      }
      resetFeedForm();
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan pakan.');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (ft: FeedType) => {
    if (!can || !confirm(`Nonaktifkan ${ft.name}?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/budidaya/master/feed-types/${ft.id}/deactivate`, { method: 'POST', body: '{}' });
      onNotify?.('Jenis pakan dinonaktifkan.');
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menonaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AquaMasterShell
        screen="M-PAKAN"
        title="Katalog Pakan 2026"
        lead="Referensi pakan populer — harga estimasi, kemasan karung, progresi pelet."
      >
        <p className="hint aqua-s02-lead">
          Pilih preset lalu lengkapi form. Rekomendasi netral tanpa bias pemasok.
        </p>
        <label className="field">
          <span>Filter jenis ikan</span>
          <input
            type="search"
            placeholder='mis. "Lele", "Nila"'
            value={speciesFilter}
            onChange={(e) => { setSpeciesFilter(e.target.value); setPresetPick(''); }}
          />
        </label>
        <div className="trouble-result-list">
          {presets.map((p) => (
            <div key={p.id} className="trouble-result-card trouble-sev-warning">
              <strong>{p.brand} · {p.productLine}</strong>
              <span>{p.species.join(' · ')}</span>
              <small>
                ~Rp {p.pricePerKg2026.toLocaleString('id-ID')}/kg · Karung {p.bagSizesKg.join('/') } kg
              </small>
              <div className="trouble-chip-grid" style={{ marginTop: 8 }}>
                {p.pelletStages.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    className="species-chip"
                    disabled={!can}
                    onClick={() => applyPreset(p, s.code)}
                    title={`${s.label} — bobot ikan ${s.fishWeightG}`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
              {can ? (
                <button type="button" className="btn-sm" style={{ marginTop: 8 }} onClick={() => applyPreset(p)}>
                  Gunakan preset → form
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </AquaMasterShell>

      <section className="panel aqua-master-list">
        <h2>Kalkulator kebutuhan karung</h2>
        <div className="form form-2">
          <label className="field">
            <span>Total kebutuhan pakan (kg)</span>
            <input
              type="number"
              min={0}
              step="any"
              value={needKg}
              onChange={(e) => setNeedKg(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="mis. 450"
            />
          </label>
          <label className="field">
            <span>Ukuran karung (kg)</span>
            <select value={bagSize} onChange={(e) => setBagSize(Number(e.target.value) || 20)}>
              {(selectedPreset?.bagSizesKg || [20, 30]).map((b) => (
                <option key={b} value={b}>{b} kg</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bobot ikan (g) — ukuran pelet</span>
            <input
              type="number"
              min={0}
              step="any"
              value={fishWeightG}
              onChange={(e) => setFishWeightG(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="mis. 35"
            />
          </label>
        </div>
        {bagCalc ? (
          <p className="aqua-cycle-estimate-card" style={{ display: 'block', marginTop: 12 }}>
            <strong>Kebutuhan karung:</strong> {formatBagCalc(bagCalc)}
          </p>
        ) : null}
        {pelletHint ? (
          <p className="hint">Rekomendasi pelet: <b>{pelletHint.code}</b> ({pelletHint.label}) untuk bobot ~{pelletHint.fishWeightG}</p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Jenis pakan</h2>
        <p className="hint">
          Wajib untuk catat pakan — kelola jenis pakan di sini agar pilihan saat operasional selalu jelas.
        </p>
        {can ? (
          <form className="form form-2" onSubmit={(ev) => void submit(ev)} key={editing?.id || `new-${feedFormKey}`}>
            <label className="field">
              <span>Nama pakan</span>
              <input value={feedName} onChange={(e) => setFeedName(e.target.value)} required disabled={busy} placeholder="mis. Starter 1" />
            </label>
            <label className="field">
              <span>Merek</span>
              <input value={feedBrand} onChange={(e) => setFeedBrand(e.target.value)} disabled={busy} />
            </label>
            <label className="field">
              <span>Protein (%)</span>
              <input type="number" min={0} max={100} step="any" value={feedProtein} onChange={(e) => setFeedProtein(e.target.value)} disabled={busy} />
            </label>
            <label className="field">
              <span>Satuan</span>
              {units.length ? (
                <select value={feedUnit} onChange={(e) => setFeedUnit(e.target.value)} disabled={busy}>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>{u.code} · {u.name}</option>
                  ))}
                  {!units.some((u) => u.code === feedUnit) ? (
                    <option value={feedUnit}>{feedUnit}</option>
                  ) : null}
                </select>
              ) : (
                <input value={feedUnit} onChange={(e) => setFeedUnit(e.target.value)} disabled={busy} />
              )}
            </label>
            <label className="field">
              <span>Harga default</span>
              <input type="number" min={0} step="any" value={feedPrice} onChange={(e) => setFeedPrice(e.target.value)} disabled={busy} />
            </label>
            <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy}>{editing ? 'Simpan perubahan' : 'Tambah jenis pakan'}</button>
              {editing ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => resetFeedForm()}>Batal</button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat menambah jenis pakan.</p>
        )}
      </section>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, border: 0 }}>Daftar pakan</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Tampilkan nonaktif
          </label>
        </div>
        {err ? <p className="danger">{err}</p> : null}
        {!rows.length ? (
          <p className="empty-state">Belum ada jenis pakan. Tambahkan minimal satu agar Catat Pakan bisa jalan.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Nama</span>
              <span>Status</span>
              <span>Detail</span>
              <span>Aksi</span>
            </div>
            {rows.map((ft) => (
              <div className="tr" key={ft.id}>
                <span className="cell-stack">
                  <b>{ft.name}</b>
                  <small>{ft.brand || '—'}</small>
                </span>
                <span>{ft.isActive ? 'Aktif' : 'Nonaktif'}</span>
                <span>
                  {ft.unit}
                  {ft.proteinPct != null ? ` · ${ft.proteinPct}% protein` : ''}
                </span>
                <span className="aksi-links aksi-cols-2">
                  {can && ft.isActive ? (
                    <>
                      <button type="button" className="btn-sm" disabled={busy} onClick={() => {
                        setEditing(ft);
                        setFeedName(ft.name);
                        setFeedBrand(ft.brand || '');
                        setFeedProtein(ft.proteinPct != null ? String(ft.proteinPct) : '');
                        setFeedUnit(ft.unit || 'kg');
                        setFeedPrice(ft.defaultPrice != null ? String(ft.defaultPrice) : '');
                      }}>Ubah</button>
                      <button type="button" className="btn-sm aksi-del" disabled={busy} onClick={() => void archive(ft)}>Nonaktif</button>
                    </>
                  ) : (
                    <span className="aksi-slot" />
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
