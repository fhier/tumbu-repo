'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const ExcelImportWizard = dynamic(
  () => import('../excel-import-wizard').then((mod) => mod.ExcelImportWizard),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm text-slate-500 animate-pulse">Memuat wizard import...</div>,
  }
);
import { progressPercent, resolveCurrentStep } from './engine';
import type { OnboardingProgress, OnboardingStateResponse, OnboardingStepDef } from './types';
import { computePondVolume, type PondShape } from '../aqua-pond-volume';
import { PondVolumeFields } from '../aqua-pond-volume-fields';

type ApiFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

/**
 * Onboarding UI host — step definitions come only from GET /platform/onboarding (API SSOT).
 */
export function OnboardingHost({
  workspaceName,
  workspaceCode,
  apiFetch,
  onNotify,
  onReady,
  onExit,
}: {
  /** @deprecated unused — kept optional for call-site compatibility */
  blueprintId?: string;
  workspaceName?: string;
  workspaceCode?: string;
  apiFetch: ApiFetch;
  onNotify: (m: string) => void;
  onReady: () => void;
  onExit: () => void;
}) {
  const [state, setState] = useState<OnboardingStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await apiFetch<OnboardingStateResponse>('/platform/onboarding');
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat onboarding.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const steps = state?.steps ?? [];
  const progress = state?.progress;
  const readyWithoutSteps = state?.readyWithoutSteps ?? true;
  const title = state?.title || 'Setup usaha';

  const current = useMemo(() => {
    if (!steps.length || !progress) return null;
    return resolveCurrentStep(steps, progress, state?.facts || {});
  }, [steps, progress, state?.facts]);

  const pct = progressPercent(steps, current?.id);
  const stepNo = current ? steps.findIndex((s) => s.id === current.id) + 1 : 1;

  const saveProgress = async (patch: Partial<OnboardingProgress> & { markCompleted?: boolean }) => {
    const body = {
      currentStepId: patch.currentStepId,
      skippedStepIds: patch.skippedStepIds,
      markCompleted: patch.markCompleted,
    };
    const next = await apiFetch<OnboardingStateResponse>('/platform/onboarding', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    setState(next);
    return next;
  };

  const goNextAfter = async (step: OnboardingStepDef) => {
    const idx = steps.findIndex((s) => s.id === step.id);
    const nextStep = steps[idx + 1];
    if (nextStep) {
      await saveProgress({ currentStepId: nextStep.id });
    } else {
      const done = await saveProgress({ markCompleted: true, currentStepId: 'ready' });
      if (done.ready) onReady();
    }
  };

  const onSkip = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const skipped = Array.from(new Set([...(progress?.skippedStepIds || []), current.id]));
      const idx = steps.findIndex((s) => s.id === current.id);
      const nextStep = steps[idx + 1];
      if (readyWithoutSteps && (!nextStep || nextStep.id === 'ready')) {
        await saveProgress({ skippedStepIds: skipped, markCompleted: true, currentStepId: 'ready' });
        onReady();
        return;
      }
      if (nextStep) {
        await saveProgress({ skippedStepIds: skipped, currentStepId: nextStep.id });
      } else {
        await saveProgress({ skippedStepIds: skipped, currentStepId: current.id });
      }
      onNotify('Progress disimpan. Anda bisa lanjut nanti.');
      await reload();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const onPause = async () => {
    setBusy(true);
    try {
      if (current) {
        await saveProgress({ currentStepId: current.id });
      }
      onNotify('Progress disimpan. Login lagi untuk lanjut dari langkah terakhir.');
      onExit();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !state) {
    return <p className="hint">Memuat setup usaha…</p>;
  }

  if (!loading && state && steps.length === 0) {
    return (
      <section className="panel onb-shell onb-shell--ready">
        <p className="hint">Setup usaha sudah siap. Membuka dashboard operasional…</p>
        <button type="button" className="tl-btn tl-btn-primary" onClick={onReady}>Buka Dashboard</button>
      </section>
    );
  }

  return (
    <section className="panel onb-shell">
      <div className="onb-hero-strip" aria-hidden="true">
        <span className="onb-hero-badge">Setup Usaha</span>
        <p>Langkah singkat agar operasional harian siap dipakai.</p>
      </div>
      <header className="onb-header">
        <div>
          <p className="onb-kicker">Setup usaha</p>
          <h2>{title}</h2>
          {workspaceName ? (
            <p className="hint" style={{ margin: 0 }}>
              {workspaceName}{workspaceCode ? ` · ${workspaceCode}` : ''}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onPause()}>
          Simpan & keluar
        </button>
      </header>

      <div className="onb-progress" aria-label={`Progress ${pct}%`}>
        <div className="onb-progress-track">
          <div className="onb-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="onb-progress-meta">
          <span>Langkah {stepNo} dari {steps.length}</span>
          <span>{pct}%</span>
        </div>
      </div>

      {error ? <p className="danger">{error}</p> : null}

      {current ? (
        <div className="onb-step">
          <h3>{current.title}</h3>
          <p className="hint">{current.description}</p>

          {current.kind === 'form_pond' && (
            <PondStepForm
              apiFetch={apiFetch}
              busy={busy}
              setBusy={setBusy}
              onNotify={onNotify}
              onDone={async () => {
                await goNextAfter(current);
                await reload();
              }}
            />
          )}

          {current.kind === 'form_species' && (
            <SpeciesStepForm
              apiFetch={apiFetch}
              busy={busy}
              setBusy={setBusy}
              onNotify={onNotify}
              allowedSpecies={state?.allowedSpecies || []}
              speciesTier={state?.speciesTier || 'single'}
              speciesOptions={state?.speciesOptions}
              onDone={async () => {
                await goNextAfter(current);
                await reload();
              }}
            />
          )}

          {current.kind === 'excel_import' && (
            <div className="onb-excel">
              <ExcelImportWizard
                compact
                apiFetch={apiFetch}
                onNotify={onNotify}
                confirmWorkspaceCode={workspaceCode}
                onDone={async () => {
                  onNotify('Data lama berhasil diimpor.');
                  await goNextAfter(current);
                  await reload();
                }}
              />
            </div>
          )}

          {current.kind === 'ready' && (
            <div className="onb-ready">
              <p>
                {state?.ready
                  ? 'Usaha siap — Anda sudah bisa memulai aktivitas bisnis pertama.'
                  : 'Selesaikan langkah wajib agar workspace siap.'}
              </p>
              <button
                type="button"
                className="tl-btn tl-btn-primary"
                disabled={busy || (readyWithoutSteps ? false : !state?.ready)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveProgress({ markCompleted: true, currentStepId: 'ready' });
                    onReady();
                  } catch (e) {
                    onNotify(e instanceof Error ? e.message : 'Gagal menyelesaikan setup.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Buka Dashboard
              </button>
            </div>
          )}

          {current.skipLabel && current.kind !== 'ready' ? (
            <div className="onb-actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onSkip()}>
                {current.skipLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PondStepForm({
  apiFetch,
  busy,
  setBusy,
  onNotify,
  onDone,
}: {
  apiFetch: ApiFetch;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotify: (m: string) => void;
  onDone: () => Promise<void>;
}) {
  type VesselGroup = {
    id: string;
    label: string;
    hint: string;
    defaultSystem: string;
    systemCodes: string[];
    metric: 'volume_liter' | 'diameter_or_volume' | 'area_m2';
  };

  const [groups, setGroups] = useState<VesselGroup[]>([]);
  const [groupId, setGroupId] = useState('ember');
  const [systemType, setSystemType] = useState('EMBER');
  const [pondShape, setPondShape] = useState<PondShape>('round');
  const [lengthM, setLengthM] = useState<number | ''>('');
  const [widthM, setWidthM] = useState<number | ''>('');
  const [diameterM, setDiameterM] = useState<number | ''>('');
  const [depthM, setDepthM] = useState<number | ''>('');
  const pondVol = computePondVolume({ shape: pondShape, lengthM, widthM, diameterM, depthM });

  useEffect(() => {
    apiFetch<VesselGroup[]>('/budidaya/master/catalog/vessel-groups')
      .then((rows) => {
        if (rows?.length) {
          setGroups(rows);
          setGroupId(rows[0].id);
          setSystemType(rows[0].defaultSystem);
        }
      })
      .catch(() => {
        setGroups([
          { id: 'ember', label: 'Ember / Galon / Drum', hint: 'Metrik: Volume (Liter).', defaultSystem: 'EMBER', systemCodes: ['EMBER', 'GALON', 'DRUM'], metric: 'volume_liter' },
          { id: 'terpal', label: 'Kolam Terpal / Bulat / Bioflok', hint: 'Metrik: Diameter (m) atau Volume (Liter).', defaultSystem: 'TERPAL', systemCodes: ['TERPAL', 'BULAT', 'BIOFLOK'], metric: 'diameter_or_volume' },
          { id: 'kolam', label: 'Kolam Tanah / Semen / Beton', hint: 'Metrik: Luas (m²).', defaultSystem: 'TANAH', systemCodes: ['TANAH', 'SEMEN', 'BETON'], metric: 'area_m2' },
        ]);
      });
  }, [apiFetch]);

  const group = groups.find((g) => g.id === groupId) || groups[0];

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    if (!name) {
      onNotify('Nama wadah wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name,
        systemType: systemType || group?.defaultSystem || 'EMBER',
        location: String(f.get('location') || '').trim() || undefined,
        status: 'IDLE',
      };
      const metric = group?.metric || 'volume_liter';
      if (metric === 'volume_liter') {
        const vl = f.get('volumeLiter') ? Number(f.get('volumeLiter')) : undefined;
        if (vl != null && !Number.isNaN(vl)) body.volumeLiter = vl;
      } else if (metric === 'diameter_or_volume' || metric === 'area_m2') {
        if (pondShape === 'round' && diameterM !== '') {
          body.diameterM = Number(diameterM);
          if (depthM !== '') body.depthM = Number(depthM);
        } else if (pondShape === 'box' && lengthM !== '' && widthM !== '') {
          body.lengthM = Number(lengthM);
          body.widthM = Number(widthM);
          if (depthM !== '') body.depthM = Number(depthM);
        } else if (metric === 'area_m2') {
          const a = f.get('areaM2') ? Number(f.get('areaM2')) : undefined;
          if (a != null && !Number.isNaN(a)) body.areaM2 = a;
        }
        if (pondVol.volumeM3 != null) body.volumeM3 = pondVol.volumeM3;
        else if (pondVol.volumeLiter != null) body.volumeLiter = pondVol.volumeLiter;
      } else {
        const a = f.get('areaM2') ? Number(f.get('areaM2')) : undefined;
        if (a != null && !Number.isNaN(a)) body.areaM2 = a;
      }
      await apiFetch('/budidaya/master/ponds', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onNotify('Wadah budidaya berhasil ditambahkan.');
      await onDone();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menambah wadah.');
    } finally {
      setBusy(false);
    }
  };

  const systemLabels: Record<string, string> = {
    EMBER: 'Ember', GALON: 'Galon', DRUM: 'Drum',
    TERPAL: 'Terpal', BULAT: 'Bulat', BIOFLOK: 'Bioflok', RAS: 'RAS',
    TANAH: 'Tanah', SEMEN: 'Semen', BETON: 'Beton', KERAMBA: 'Keramba',
  };

  return (
    <form className="form onb-form onb-form--vessel" onSubmit={submit}>
      <div className="onb-section">
        <span className="onb-section-label">Tipe wadah</span>
        <div className="vessel-type-grid">
          {(groups.length ? groups : []).map((g) => {
            const short = g.id === 'ember' ? 'Ember / Galon' : g.id === 'terpal' ? 'Terpal / Bioflok' : 'Tanah / Semen';
            const icoClass = g.id === 'ember' ? 'is-ember' : g.id === 'terpal' ? 'is-terpal' : 'is-kolam';
            return (
              <button
                key={g.id}
                type="button"
                className={`vessel-type-card${groupId === g.id ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => {
                  setGroupId(g.id);
                  setSystemType(g.defaultSystem);
                  setPondShape(g.id === 'terpal' ? 'round' : 'box');
                  setLengthM('');
                  setWidthM('');
                  setDiameterM('');
                  setDepthM('');
                }}
              >
                <span className={`vessel-type-ico ${icoClass}`} aria-hidden="true" />
                <span className="vessel-type-body">
                  <strong className="vessel-type-title">{short}</strong>
                  <span className="vessel-type-hint">{g.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {group && group.systemCodes.length > 1 ? (
        <label className="onb-section">
          Varian
          <select
            value={systemType}
            disabled={busy}
            onChange={(e) => setSystemType(e.target.value)}
          >
            {group.systemCodes.map((c) => (
              <option key={c} value={c}>{systemLabels[c] || c}</option>
            ))}
          </select>
          <span className="field-help">Pilih varian yang paling mendekati wadah Anda.</span>
        </label>
      ) : null}

      <label className="onb-section">
        Nama wadah *
        <input
          name="name"
          placeholder='mis. "Ember Lele 01", "Kolam Terpal Depan"'
          required
          disabled={busy}
          autoComplete="off"
        />
        <span className="field-help">
          Beri nama yang mudah dikenali di lapangan. Kode wadah (WDH-001, …) dibuat otomatis oleh sistem.
        </span>
      </label>

      {group?.metric === 'volume_liter' ? (
        <label className="onb-section">
          Volume (Liter)
          <input name="volumeLiter" type="number" min={0} step="any" placeholder="mis. 200" disabled={busy} />
          <span className="field-help">Isi kapasitas ember/galon/drum dalam liter.</span>
        </label>
      ) : null}

      {group?.metric === 'diameter_or_volume' || group?.metric === 'area_m2' ? (
        <div className="onb-section">
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
        </div>
      ) : null}

      <label className="onb-section">
        Lokasi — opsional
        <input name="location" placeholder="mis. Halaman depan, Blok A" disabled={busy} />
        <span className="field-help">Bantu tim menemukan wadah di lokasi usaha.</span>
      </label>

      <button type="submit" className="tl-btn tl-btn-primary" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan wadah & lanjut'}
      </button>
    </form>
  );
}

function SpeciesStepForm({
  apiFetch,
  busy,
  setBusy,
  onNotify,
  onDone,
  allowedSpecies,
  speciesTier,
  speciesOptions,
}: {
  apiFetch: ApiFetch;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotify: (m: string) => void;
  onDone: () => Promise<void>;
  allowedSpecies: string[];
  speciesTier: 'single' | 'multi';
  speciesOptions?: { code: string; label: string }[];
}) {
  const options = speciesOptions?.length
    ? speciesOptions
    : [
      { code: 'LELE', label: 'Lele' }, { code: 'NILA', label: 'Nila' },
      { code: 'GURAME', label: 'Gurame' }, { code: 'PATIN', label: 'Patin' },
      { code: 'MAS', label: 'Mas' }, { code: 'BAWAL', label: 'Bawal' },
    ];
  const labelOf = (code: string) => options.find((o) => o.code === code)?.label || code;

  const registered = allowedSpecies.length ? allowedSpecies : [];
  const [extraPick, setExtraPick] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState(registered[0] || 'LELE');
  const canAddSecondary = speciesTier === 'multi';

  const ensureSpecies = async (codes: string[]) => {
    for (const code of codes) {
      try {
        await apiFetch('/budidaya/master/species', {
          method: 'POST',
          body: JSON.stringify({ code, name: labelOf(code), isActive: true }),
        });
      } catch {
        /* duplikat / sudah ada — lanjut */
      }
    }
  };

  const confirmRegistered = async () => {
    const codes = [...new Set([...registered, ...extraPick])];
    if (!codes.length) {
      onNotify('Tidak ada spesies terdaftar. Pilih spesies di bawah.');
      return;
    }
    setBusy(true);
    try {
      await ensureSpecies(codes);
      // Merge only — jangan overwrite allowedSpecies registrasi dengan satu spesies
      if (extraPick.length) {
        await apiFetch('/platform/workspace/filter-context', {
          method: 'PATCH',
          body: JSON.stringify({ allowedSpecies: codes, merge: true }),
        }).catch(() => undefined);
      }
      onNotify(codes.length > 1
        ? `Spesies siap: ${codes.map(labelOf).join(', ')}.`
        : `Spesies ${labelOf(codes[0])} siap dipakai.`);
      await onDone();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyiapkan spesies.');
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const code = String(f.get('code') || manualCode || '').trim().toUpperCase();
    const name = String(f.get('name') || labelOf(code)).trim();
    setBusy(true);
    try {
      await ensureSpecies([code]);
      await apiFetch('/platform/workspace/filter-context', {
        method: 'PATCH',
        body: JSON.stringify({ primarySpecies: code, allowedSpecies: [code], merge: true }),
      }).catch(() => undefined);
      onNotify(`${name} berhasil ditambahkan.`);
      await onDone();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menambah jenis ikan.');
    } finally {
      setBusy(false);
    }
  };

  if (registered.length) {
    return (
      <div className="onb-form" style={{ display: 'grid', gap: 12 }}>
        <div className="onb-species-confirmed">
          <h4>Spesies dari registrasi</h4>
          <div className="species-chip-grid">
            {registered.map((code) => (
              <span key={code} className="species-chip is-active is-primary">{labelOf(code)}</span>
            ))}
          </div>
          <span className="field-help" style={{ marginTop: 8 }}>
            Spesies ini sudah dipilih saat daftar. Tidak perlu diisi ulang.
            {speciesTier === 'single' ? ' Paket Single Species — satu spesies utama.' : ''}
          </span>
        </div>

        {canAddSecondary ? (
          <div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Tambah spesies sekunder (opsional)</span>
            <div className="species-chip-grid" style={{ marginTop: 8 }}>
              {options.filter((o) => !registered.includes(o.code)).map((s) => {
                const on = extraPick.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    className={`species-chip${on ? ' is-active' : ''}`}
                    disabled={busy}
                    onClick={() => {
                      setExtraPick((prev) => (
                        on ? prev.filter((c) => c !== s.code) : [...prev, s.code].slice(0, 4)
                      ));
                    }}
                  >
                    {on ? '✓ ' : ''}{s.label}
                  </button>
                );
              })}
            </div>
            <span className="field-help">Hanya untuk paket Multi Species.</span>
          </div>
        ) : null}

        <button
          type="button"
          className="tl-btn tl-btn-primary"
          disabled={busy}
          onClick={() => void confirmRegistered()}
        >
          {busy ? 'Menyiapkan…' : 'Lanjutkan dengan spesies terdaftar'}
        </button>
      </div>
    );
  }

  // Fallback: belum ada allowedSpecies (workspace lama / seed)
  return (
    <form className="form onb-form" onSubmit={submitManual}>
      <p className="hint" style={{ margin: 0 }}>
        Belum ada spesies dari registrasi. Pilih spesies utama untuk workspace ini.
      </p>
      <div className="species-chip-grid">
        {options.map((s) => (
          <button
            key={s.code}
            type="button"
            className={`species-chip${manualCode === s.code ? ' is-active is-primary' : ''}`}
            disabled={busy}
            onClick={() => setManualCode(s.code)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="code" value={manualCode} />
      <input type="hidden" name="name" value={labelOf(manualCode)} />
      <button type="submit" className="tl-btn tl-btn-primary" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan spesies & lanjut'}
      </button>
    </form>
  );
}
