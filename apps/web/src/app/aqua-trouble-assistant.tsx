'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeDrugDose,
  searchTrouble,
  volumeLiterFromPond,
  type TroubleEntry,
} from './aqua-trouble-knowledge';
import type { ApiFetch } from './aqua-shared';

type PondOption = {
  id: string;
  code: string;
  name: string;
  volumeM3?: number | string | null;
};

export function AquaTroubleAssistant({ apiFetch }: { apiFetch?: ApiFetch }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TroubleEntry | null>(null);
  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [pondId, setPondId] = useState('');
  const [manualLiter, setManualLiter] = useState<number | ''>('');

  const loadPonds = useCallback(async () => {
    if (!apiFetch) return;
    try {
      const rows = await apiFetch<PondOption[]>('/budidaya/master/ponds');
      setPonds(rows);
      if (rows.length && !pondId) setPondId(rows[0].id);
    } catch {
      /* optional */
    }
  }, [apiFetch, pondId]);

  useEffect(() => {
    void loadPonds();
  }, [loadPonds]);

  const results = useMemo(() => searchTrouble(query), [query]);

  const activePond = useMemo(
    () => ponds.find((p) => p.id === pondId) || null,
    [ponds, pondId],
  );

  const volumeLiter = useMemo(() => {
    const manual = typeof manualLiter === 'number' ? manualLiter : Number(manualLiter);
    if (Number.isFinite(manual) && manual > 0) return manual;
    if (activePond) return volumeLiterFromPond(activePond);
    return null;
  }, [manualLiter, activePond]);

  return (
    <>
      <section className="panel">
        <h2>Pencegahan & Penanganan Penyakit (P3K Ikan)</h2>
        <p className="hint">
          Cari gejala visual untuk rencana pertolongan pertama. Dosis obat dihitung dari volume air kolam Anda — bukan pengganti diagnosa laboratorium.
        </p>
        <div className="form form-2">
          <label className="field">
            <span>Kolam / wadah (volume air)</span>
            <select value={pondId} onChange={(e) => setPondId(e.target.value)} disabled={!ponds.length}>
              {!ponds.length ? <option value="">— Belum ada kolam —</option> : null}
              {ponds.map((p) => {
                const vl = volumeLiterFromPond(p);
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}{vl ? ` (${vl.toLocaleString('id-ID')} L)` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="field">
            <span>Volume manual (Liter) — opsional</span>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="Override volume kolam"
              value={manualLiter}
              onChange={(e) => setManualLiter(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
        </div>
        {volumeLiter != null ? (
          <p className="aqua-cycle-estimate-card" style={{ display: 'block', marginTop: 8 }}>
            <strong>Volume air untuk dosis:</strong> {volumeLiter.toLocaleString('id-ID')} L
            ({(volumeLiter / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m³)
          </p>
        ) : (
          <p className="hint">Isi dimensi kolam di Master Kolam atau volume manual agar dosis obat presisi.</p>
        )}
        <label className="field full">
          <span>Cari gejala</span>
          <input
            type="search"
            placeholder='mis. "Gantung", "White Spot", "Luka borok", "Kumis putung"'
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          />
        </label>
        <div className="trouble-chip-grid">
          {['Ikan menggantung', 'White Spot', 'Luka borok', 'Kumis putung'].map((chip) => (
            <button
              key={chip}
              type="button"
              className={`species-chip${query === chip ? ' is-active' : ''}`}
              onClick={() => { setQuery(chip); setSelected(null); }}
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{selected ? selected.title : 'Hasil pencarian'}</h2>
        {!selected ? (
          <div className="trouble-result-list">
            {results.map((r) => {
              const dosePreview = r.drugRules?.length && volumeLiter
                ? computeDrugDose(r.drugRules[0], volumeLiter)
                : null;
              const severityLabel = r.severity === 'critical' ? 'Darurat' : 'Perhatian';
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`trouble-result-card trouble-sev-${r.severity}`}
                  onClick={() => setSelected(r)}
                >
                  <div className="trouble-result-head">
                    <strong>{r.title}</strong>
                    <span className={`trouble-tag trouble-tag-${r.severity}`}>{severityLabel}</span>
                  </div>
                  <p className="trouble-result-symptoms">{r.symptoms.slice(0, 3).join(' · ')}</p>
                  {dosePreview ? (
                    <div className="trouble-result-dose">
                      <span className="trouble-dose-label">Dosis obat</span>
                      <strong>{r.drugRules![0].drug}</strong>
                      <span>{dosePreview}</span>
                    </div>
                  ) : r.medicineHint ? (
                    <div className="trouble-result-dose trouble-result-dose-muted">
                      <span className="trouble-dose-label">Saran obat</span>
                      <span>{r.medicineHint}</span>
                    </div>
                  ) : null}
                </button>
              );
            })}
            {!results.length ? (
              <p className="empty-state">Gejala tidak ditemukan. Coba kata kunci lain.</p>
            ) : null}
          </div>
        ) : (
          <div className="trouble-detail">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(null)}>
              ← Kembali ke daftar
            </button>
            <p className="hint">Gejala: {selected.symptoms.join(' · ')}</p>
            {selected.actions.map((a) => (
              <div key={a.title} className="trouble-action-block">
                <h4>{a.title}</h4>
                <ol>
                  {a.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
            {selected.saltDose ? (
              <p className="trouble-dose"><b>Garam:</b> {selected.saltDose}</p>
            ) : null}
            {selected.medicineHint ? (
              <p className="trouble-dose"><b>Obat:</b> {selected.medicineHint}</p>
            ) : null}
            {selected.drugRules?.length ? (
              <div className="trouble-action-block">
                <h4>Dosis obat (berdasarkan volume kolam)</h4>
                {!volumeLiter ? (
                  <p className="hint">Pilih kolam atau isi volume manual untuk kalkulasi dosis.</p>
                ) : (
                  <div className="trouble-dose-grid">
                    {selected.drugRules.map((rule) => {
                      const dose = computeDrugDose(rule, volumeLiter);
                      return (
                        <div key={rule.drug} className="trouble-dose-card">
                          <span className="trouble-dose-label">{rule.drug}</span>
                          <strong>{dose || '—'}</strong>
                          {rule.notes ? <small>{rule.notes}</small> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
