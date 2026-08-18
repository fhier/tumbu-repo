'use client';

/**
 * Katalog Komoditas — spesies + varietas/strain + ukuran tebar terintegrasi.
 * Menggantikan menu terpisah "Jenis ikan" & "Jenis / Varietas Ikan".
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiFetch, canManageMaster } from './aqua-shared';
import { filterByAllowedSpecies, SPECIES_LICENSE_OPTIONS } from './filter-context';
import {
  baselineFromSize,
  PRIMARY_SPECIES_OPTIONS,
  SEED_SIZE_BENCHMARKS,
  STRAIN_CATALOG,
} from './aqua-seed-benchmark';

type SpeciesRow = {
  id: string;
  code: string;
  name: string;
  typicalDays?: number | null;
  typicalFcr?: number | null;
  typicalSrPct?: number | null;
  isActive: boolean;
};

type StrainRow = {
  id: string;
  code: string;
  name: string;
  speciesProfileId?: string | null;
  isActive: boolean;
  notes?: string | null;
  speciesProfile?: { code: string; name: string } | null;
};

function safeReset(form: HTMLFormElement | null | undefined) {
  if (form?.isConnected) {
    try { form.reset(); } catch { /* ignore */ }
  }
}

export function CommodityCatalog({
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
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const [strains, setStrains] = useState<StrainRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [formKey, setFormKey] = useState(0);

  const [speciesCode, setSpeciesCode] = useState('LELE');
  const [strainCode, setStrainCode] = useState('');
  const [sizeId, setSizeId] = useState('5-7');
  const [baseline, setBaseline] = useState<ReturnType<typeof baselineFromSize>>(null);

  const speciesOptions = useMemo(() => {
    const allowed = allowedSpecies.length
      ? PRIMARY_SPECIES_OPTIONS.filter((o) => allowedSpecies.includes(o.code))
      : PRIMARY_SPECIES_OPTIONS;
    return allowed.length ? allowed : PRIMARY_SPECIES_OPTIONS;
  }, [allowedSpecies]);

  const strainOptions = useMemo(() => {
    const catalog = STRAIN_CATALOG[speciesCode] || [];
    const fromApi = strains
      .filter((s) => s.isActive && s.speciesProfile?.code === speciesCode)
      .map((s) => ({ code: s.code, name: s.name }));
    const merged = [...catalog];
    for (const s of fromApi) {
      if (!merged.some((m) => m.code === s.code)) merged.push(s);
    }
    return merged;
  }, [speciesCode, strains]);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [sp, st] = await Promise.all([
        apiFetch<SpeciesRow[]>('/budidaya/master/species'),
        apiFetch<StrainRow[]>('/budidaya/master/strains'),
      ]);
      setSpecies(sp.filter((x) => x.isActive));
      setStrains(st.filter((x) => x.isActive));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat katalog.');
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const sp = species.find((s) => s.code === speciesCode);
    setBaseline(baselineFromSize(sp || { code: speciesCode }, sizeId));
  }, [speciesCode, sizeId, species]);

  useEffect(() => {
    if (strainOptions.length && !strainOptions.some((s) => s.code === strainCode)) {
      setStrainCode(strainOptions[0]?.code || '');
    }
  }, [strainOptions, strainCode]);

  const resolveSpeciesId = async (): Promise<string> => {
    const fresh = await apiFetch<SpeciesRow[]>('/budidaya/master/species');
    let hit = fresh.find((s) => s.code === speciesCode);
    if (hit) return hit.id;
    const label = SPECIES_LICENSE_OPTIONS.find((o) => o.code === speciesCode)?.label
      || speciesCode;
    const bl = baselineFromSize({ code: speciesCode }, sizeId);
    try {
      const created = await apiFetch<SpeciesRow>('/budidaya/master/species', {
        method: 'POST',
        body: JSON.stringify({
          code: speciesCode,
          name: label,
          typicalDays: bl?.targetDays,
          typicalFcr: bl?.targetFcr,
          typicalSrPct: bl?.targetSrPct,
          isActive: true,
        }),
      });
      return created.id;
    } catch {
      const again = await apiFetch<SpeciesRow[]>('/budidaya/master/species');
      hit = again.find((s) => s.code === speciesCode);
      if (hit) return hit.id;
      throw new Error('Spesies belum tersedia. Muat spesies umum terlebih dahulu.');
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!can || !strainCode) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const strainName = String(f.get('strainName') || '').trim()
      || strainOptions.find((s) => s.code === strainCode)?.name
      || strainCode;
    setBusy(true);
    try {
      const speciesProfileId = await resolveSpeciesId();
      const notes = [
        `Ukuran tebar: ${SEED_SIZE_BENCHMARKS.find((s) => s.id === sizeId)?.label || sizeId}`,
        baseline ? `Target: ${baseline.targetDays} h · FCR ${baseline.targetFcr} · SR ${baseline.targetSrPct}%` : '',
        baseline?.sop || '',
      ].filter(Boolean).join(' · ');

      const existing = strains.find(
        (s) => s.code === strainCode && s.speciesProfileId === speciesProfileId,
      );
      if (existing) {
        await apiFetch(`/budidaya/master/strains/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: strainName, notes }),
        });
        onNotify?.('Varietas diperbarui.');
      } else {
        await apiFetch('/budidaya/master/strains', {
          method: 'POST',
          body: JSON.stringify({
            code: strainCode,
            name: strainName,
            speciesProfileId,
            notes,
          }),
        });
        onNotify?.('Varietas ditambahkan ke katalog.');
      }
      await load();
      safeReset(form);
      setFormKey((k) => k + 1);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal menyimpan katalog.');
    } finally {
      setBusy(false);
    }
  };

  const ensureSpecies = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await apiFetch('/budidaya/master/species/ensure-defaults', { method: 'POST', body: '{}' });
      onNotify?.('Spesies umum dimuat.');
      await load();
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal memuat spesies.');
    } finally {
      setBusy(false);
    }
  };

  const visibleStrains = useMemo(
    () => filterByAllowedSpecies(strains, allowedSpecies, (s) => s.speciesProfile?.code || s.code),
    [strains, allowedSpecies],
  );

  return (
    <>
      <section className="panel">
        <h2>Katalog Komoditas</h2>
        <p className="hint">
          Satu tempat untuk spesies, varietas/strain, dan ukuran tebar. Baseline siklus terisi otomatis saat ukuran dipilih.
        </p>
        {can ? (
          <p style={{ marginTop: 0 }}>
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void ensureSpecies()}>
              Muat spesies umum
            </button>
          </p>
        ) : null}

        {can ? (
          <form className="form form-2 komoditas-form" onSubmit={(ev) => void submit(ev)} key={formKey}>
            <label className="field">
              <span>Spesies utama *</span>
              <select
                value={speciesCode}
                disabled={busy}
                onChange={(e) => setSpeciesCode(e.target.value)}
              >
                {speciesOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Varietas / Strain *</span>
              <div className="species-chip-grid" style={{ marginTop: 6 }}>
                {strainOptions.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    className={`species-chip${strainCode === s.code ? ' is-active is-primary' : ''}`}
                    disabled={busy}
                    onClick={() => setStrainCode(s.code)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <input type="hidden" name="strainCode" value={strainCode} />
            </label>

            <label className="field">
              <span>Nama tampilan varietas</span>
              <input
                name="strainName"
                disabled={busy}
                placeholder={strainOptions.find((s) => s.code === strainCode)?.name || 'Nama varietas'}
              />
            </label>

            <label className="field">
              <span>Ukuran tebar / Size benchmark *</span>
              <select value={sizeId} disabled={busy} onChange={(e) => setSizeId(e.target.value)}>
                {SEED_SIZE_BENCHMARKS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>

            {baseline ? (
              <div className="komoditas-baseline" style={{ gridColumn: '1 / -1' }}>
                <h4>Baseline otomatis</h4>
                <div className="komoditas-baseline-grid">
                  <div><span>Target hari</span><strong>{baseline.targetDays}</strong></div>
                  <div><span>Target FCR</span><strong>{baseline.targetFcr}</strong></div>
                  <div><span>Target SR</span><strong>{baseline.targetSrPct}%</strong></div>
                  <div><span>Berat acuan</span><strong>{baseline.weightGram} g/ekor</strong></div>
                </div>
                <p className="field-help" style={{ marginTop: 8 }}><b>SOP:</b> {baseline.sop}</p>
                <p className="field-help">{baseline.hint}</p>
              </div>
            ) : null}

            <div className="tb-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={busy || !strainCode}>
                Simpan ke katalog
              </button>
            </div>
          </form>
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat mengubah katalog komoditas.</p>
        )}
      </section>

      <section className="panel">
        <h2>Daftar komoditas</h2>
        {err ? <p className="danger">{err}</p> : null}
        {!visibleStrains.length ? (
          <p className="empty-state">Belum ada varietas. Simpan dari form di atas.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Spesies / Varietas</span>
              <span>Baseline</span>
              <span>Catatan</span>
            </div>
            {visibleStrains.map((r) => (
              <div className="tr" key={r.id}>
                <span className="cell-stack">
                  <b>{r.code}</b>
                  <small>{r.name}{r.speciesProfile ? ` · ${r.speciesProfile.name}` : ''}</small>
                </span>
                <span>{r.speciesProfile?.code || '—'}</span>
                <span><small>{r.notes || '—'}</small></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
