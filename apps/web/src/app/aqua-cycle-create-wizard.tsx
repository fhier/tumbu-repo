'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  DAY_PRESETS,
  FCR_PRESETS,
  SR_PRESETS,
  suggestTargetsForSpecies,
} from './aqua-cycle-predict';
import {
  PELLET_PROGRESSION,
  classifyDensity,
  densityRecommendations,
  estimatePreStockBop,
  estimateFeedKgPreStock,
} from './aqua-cycle-stocking';
import { estimateTargetHarvestKg } from './aqua-cycle-target-calc';
import { AquaCycleTargetFields } from './aqua-cycle-target-fields';

type PondOpt = {
  id: string;
  code: string;
  name: string;
  volumeM3?: number | string | null;
};
type SpeciesOpt = {
  id: string;
  code: string;
  name: string;
  typicalDays?: number | null;
  typicalFcr?: number | null;
  typicalSrPct?: number | null;
  targetWeightGram?: number | null;
};

const STEPS = ['Kolam & Padat Tebar', 'Benih', 'Pakan & FCR', 'Rencana BOP'] as const;

export function AquaCycleCreateWizard({
  ponds,
  species,
  busy,
  onSubmit,
  profitAdvisorLocked = false,
}: {
  ponds: PondOpt[];
  species: SpeciesOpt[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  profitAdvisorLocked?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [pondId, setPondId] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [targetDays, setTargetDays] = useState('90');
  const [targetFcr, setTargetFcr] = useState('1.2');
  const [targetSrPct, setTargetSrPct] = useState('85');
  const [targetWeightGram, setTargetWeightGram] = useState('100');
  const [seedCount, setSeedCount] = useState('');
  const [seedUnitCost, setSeedUnitCost] = useState('150');
  const [feedPricePerKg, setFeedPricePerKg] = useState('14500');
  const [operasionalCost, setOperasionalCost] = useState('500000');
  const [speciesHint, setSpeciesHint] = useState('');

  const selectedPond = useMemo(() => ponds.find((p) => p.id === pondId) || null, [ponds, pondId]);
  const volumeM3 = useMemo(() => {
    const v = selectedPond?.volumeM3;
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedPond]);

  const densities = useMemo(() => densityRecommendations(volumeM3), [volumeM3]);
  const seedN = Number(seedCount) || 0;
  const pcsPerM3 = volumeM3 && seedN > 0 ? seedN / volumeM3 : null;
  const densityBand = pcsPerM3 != null ? classifyDensity(pcsPerM3) : null;

  const feedKg = useMemo(
    () => estimateFeedKgPreStock({
      seedCount: seedN,
      targetFcr: Number(targetFcr) || 0,
      targetWeightGram: Number(targetWeightGram) || 0,
    }),
    [seedN, targetFcr, targetWeightGram],
  );

  const harvestKgAuto = useMemo(
    () => estimateTargetHarvestKg({
      seedCount: seedN,
      targetSrPct: Number(targetSrPct) || 0,
      targetWeightGram: Number(targetWeightGram) || 0,
    }),
    [seedN, targetSrPct, targetWeightGram],
  );

  const bop = useMemo(
    () => estimatePreStockBop({
      seedCount: seedN,
      seedUnitCost: Number(seedUnitCost) || 0,
      targetFcr: Number(targetFcr) || 0,
      targetWeightGram: Number(targetWeightGram) || 0,
      feedPricePerKg: Number(feedPricePerKg) || 0,
      operasionalCost: Number(operasionalCost) || 0,
    }),
    [seedN, seedUnitCost, targetFcr, targetWeightGram, feedPricePerKg, operasionalCost],
  );

  const applySpecies = (id: string) => {
    setSpeciesId(id);
    const sp = species.find((x) => x.id === id);
    if (!sp) {
      setSpeciesHint('');
      return;
    }
    const sug = suggestTargetsForSpecies(sp);
    setTargetDays(String(sug.targetDays));
    setTargetFcr(String(sug.targetFcr));
    setTargetSrPct(String(sug.targetSrPct));
    setTargetWeightGram(String(sug.targetWeightGram));
    setSpeciesHint(sug.hint);
  };

  const canNext = () => {
    if (step === 0) return !!pondId && volumeM3 != null;
    if (step === 1) return !!speciesId && seedN > 0;
    if (step === 2) return Number(targetFcr) > 0 && Number(targetWeightGram) > 0;
    return true;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      if (canNext()) setStep((s) => s + 1);
      return;
    }
    const f = new FormData(e.currentTarget);
    await onSubmit({
      pondId,
      speciesProfileId: speciesId,
      code: code.trim() || undefined,
      notes: notes.trim() || undefined,
      initialCapital: f.get('targetBopAmount') ? Number(f.get('targetBopAmount')) : (bop?.total || undefined),
      targetDays: targetDays ? Number(targetDays) : undefined,
      targetFcr: targetFcr ? Number(targetFcr) : undefined,
      targetSrPct: targetSrPct ? Number(targetSrPct) : undefined,
      targetWeightGram: targetWeightGram ? Number(targetWeightGram) : undefined,
      targetHarvestKg: f.get('targetHarvestKg') ? Number(f.get('targetHarvestKg')) : (harvestKgAuto ?? undefined),
      targetBopAmount: f.get('targetBopAmount') ? Number(f.get('targetBopAmount')) : (bop?.total ?? undefined),
    });
  };

  return (
    <form className="form form-2 aqua-cycle-wizard" onSubmit={(ev) => void submit(ev)}>
      <div className="aqua-cycle-wizard-steps" style={{ gridColumn: '1 / -1' }}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`species-chip${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
            disabled={busy || i > step}
            onClick={() => i < step && setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <>
          <label className="field">
            <span>Kolam</span>
            <select value={pondId} required disabled={busy} onChange={(e) => setPondId(e.target.value)}>
              <option value="">Pilih kolam…</option>
              {ponds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                  {p.volumeM3 != null ? ` · ${Number(p.volumeM3)} m³` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Volume air kolam</span>
            <strong>{volumeM3 != null ? `${volumeM3.toLocaleString('id-ID')} m³` : '— Isi dimensi di Master Kolam —'}</strong>
          </div>
          {densities.length ? (
            <div className="cycle-estimate-card" style={{ gridColumn: '1 / -1' }}>
              <h3>Rekomendasi padat tebar (ekor)</h3>
              <div className="cycle-estimate-grid">
                {densities.map((d) => (
                  <div key={d.band} className={`density-band density-${d.band}`}>
                    <span>{d.label}</span>
                    <strong>{d.minTotal.toLocaleString('id-ID')} – {d.maxTotal.toLocaleString('id-ID')} ekor</strong>
                    <small>{d.minPerM3}–{d.maxPerM3} ekor/m³ · {d.note}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <label className="field">
            <span>Jenis ikan</span>
            <select value={speciesId} required disabled={busy} onChange={(e) => applySpecies(e.target.value)}>
              <option value="">Pilih jenis…</option>
              {species.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
            {speciesHint ? <span className="field-help">{speciesHint}</span> : null}
          </label>
          <label className="field">
            <span>Jumlah tebar (ekor)</span>
            <input
              type="number"
              min={1}
              required
              disabled={busy}
              value={seedCount}
              onChange={(e) => setSeedCount(e.target.value)}
              placeholder="mis. 5000"
            />
            {pcsPerM3 != null ? (
              <span className={`field-help density-hint-${densityBand || 'sedang'}`}>
                Padat tebar: {pcsPerM3.toFixed(1)} ekor/m³
                {densityBand === 'risiko' ? ' — ⚠ Risiko tinggi (>200/m³)' : ''}
              </span>
            ) : null}
          </label>
          <label className="field">
            <span>Biaya benih per ekor (Rp)</span>
            <input type="number" min={0} disabled={busy} value={seedUnitCost} onChange={(e) => setSeedUnitCost(e.target.value)} />
          </label>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <label className="field">
            <span>Target FCR</span>
            <select className="cycle-preset" disabled={busy} value="" onChange={(e) => { if (e.target.value) setTargetFcr(e.target.value); }}>
              <option value="">Preset…</option>
              {FCR_PRESETS.map((p) => <option key={p.fcr} value={p.fcr}>{p.label}</option>)}
            </select>
            <input type="number" min={0} step="any" disabled={busy} value={targetFcr} onChange={(e) => setTargetFcr(e.target.value)} />
          </label>
          <label className="field">
            <span>Target SR (%)</span>
            <select className="cycle-preset" disabled={busy} value="" onChange={(e) => { if (e.target.value) setTargetSrPct(e.target.value); }}>
              <option value="">Preset…</option>
              {SR_PRESETS.map((p) => <option key={p.sr} value={p.sr}>{p.label}</option>)}
            </select>
            <input type="number" min={0} max={100} disabled={busy} value={targetSrPct} onChange={(e) => setTargetSrPct(e.target.value)} />
          </label>
          <label className="field">
            <span>Target hari</span>
            <select className="cycle-preset" disabled={busy} value="" onChange={(e) => { if (e.target.value) setTargetDays(e.target.value); }}>
              <option value="">Preset…</option>
              {DAY_PRESETS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
            <input type="number" min={0} disabled={busy} value={targetDays} onChange={(e) => setTargetDays(e.target.value)} />
          </label>
          <label className="field">
            <span>Berat target panen (g/ekor)</span>
            <input type="number" min={0} disabled={busy} value={targetWeightGram} onChange={(e) => setTargetWeightGram(e.target.value)} />
          </label>
          <div className="cycle-estimate-card" style={{ gridColumn: '1 / -1' }}>
            <h3>Kebutuhan pakan (otomatis)</h3>
            <p className="hint">Rumus: Jumlah tebar × FCR × berat target (kg)</p>
            <strong>{feedKg != null ? `${feedKg.toLocaleString('id-ID')} kg` : '—'}</strong>
            <h4 style={{ marginTop: 12 }}>Progresi ukuran pelet</h4>
            <div className="trouble-chip-grid">
              {PELLET_PROGRESSION.map((p) => (
                <span key={p.code} className="species-chip" title={`${p.phase} · ${p.weightG}`}>
                  {p.code}
                </span>
              ))}
            </div>
            <small className="field-help">PF-1000 → 781-1 → 781-2 → 781-3 sesuai pertumbuhan bobot ikan.</small>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <label className="field">
            <span>Harga pakan (Rp/kg)</span>
            <input type="number" min={0} disabled={busy} value={feedPricePerKg} onChange={(e) => setFeedPricePerKg(e.target.value)} />
          </label>
          <label className="field">
            <span>Biaya operasional / gaji (estimasi)</span>
            <input type="number" min={0} disabled={busy} value={operasionalCost} onChange={(e) => setOperasionalCost(e.target.value)} />
          </label>
          <label className="field">
            <span>Kode siklus (opsional)</span>
            <input disabled={busy} value={code} onChange={(e) => setCode(e.target.value)} placeholder="otomatis jika kosong" />
          </label>
          <label className="field full">
            <span>Catatan</span>
            <input disabled={busy} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {bop ? (
            <div className="cycle-estimate-card" style={{ gridColumn: '1 / -1' }}>
              <h3>Rencana BOP Pre-Tebar</h3>
              <AquaCycleTargetFields
                seedCount={seedN}
                targetSrPct={Number(targetSrPct) || 0}
                targetWeightGram={Number(targetWeightGram) || 0}
                targetFcr={Number(targetFcr) || 0}
                seedUnitCost={Number(seedUnitCost) || 0}
                feedPricePerKg={Number(feedPricePerKg) || 0}
                operasionalCost={Number(operasionalCost) || 0}
                initialHarvestKg={harvestKgAuto}
                initialBopRp={bop.total}
                disabled={busy}
                locked={profitAdvisorLocked}
              />
              <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
                Siapkan anggaran ini sebelum membeli benih. Angka estimasi — sesuaikan dengan kondisi lapangan.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {step > 0 ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStep((s) => s - 1)}>
            ← Sebelumnya
          </button>
        ) : null}
        <button type="submit" disabled={busy || !canNext()}>
          {step < STEPS.length - 1 ? 'Lanjut →' : busy ? 'Menyimpan…' : 'Buat siklus'}
        </button>
      </div>
    </form>
  );
}
