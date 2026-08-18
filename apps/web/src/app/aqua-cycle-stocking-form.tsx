'use client';

import { FormEvent, useState } from 'react';
import { SEED_SIZE_CM_OPTIONS, type SeedSizeCm, gramsFromSeedSizeCm } from './aqua-seed-size';

const todayDate = () => new Date().toISOString().slice(0, 10);

export function AquaStockingForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: {
    quantityPcs: number;
    averageWeightGram?: number;
    unitCost?: number;
    totalCost?: number;
    notes?: string;
    eventAt?: string;
    seedSizeCm?: string;
  }) => Promise<void>;
}) {
  const [seedSize, setSeedSize] = useState<SeedSizeCm>('5-7');
  const [stockDate, setStockDate] = useState(todayDate);
  const estGram = gramsFromSeedSizeCm(seedSize);
  const selected = SEED_SIZE_CM_OPTIONS.find((o) => o.id === seedSize);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const qty = Number(f.get('quantityPcs'));
    const unitCost = f.get('unitCost') ? Number(f.get('unitCost')) : undefined;
    const totalCost = f.get('totalCost')
      ? Number(f.get('totalCost'))
      : (unitCost && qty ? unitCost * qty : undefined);
    const dateStr = String(f.get('stockDate') || stockDate).trim();
    const eventAt = dateStr ? new Date(`${dateStr}T08:00:00`).toISOString() : undefined;
    await onSubmit({
      quantityPcs: qty,
      averageWeightGram: estGram,
      unitCost,
      totalCost,
      notes: String(f.get('notes') || '').trim() || undefined,
      eventAt,
      seedSizeCm: seedSize,
    });
  };

  return (
    <section className="panel mod-form-panel">
      <h2>Catat tebar (stocking)</h2>
      <form className="form form-2" onSubmit={(ev) => void handleSubmit(ev)}>
        <label className="field">
          <span>Jumlah ekor</span>
          <input name="quantityPcs" type="number" min={1} required disabled={busy} />
        </label>
        <div className="field full">
          <span>Ukuran benih (cm)</span>
          <div className="trouble-chip-grid">
            {SEED_SIZE_CM_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`species-chip${seedSize === o.id ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => setSeedSize(o.id)}
                title={o.hint}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="field-help">
            Estimasi berat: <b>~{estGram} g/ekor</b>
            {selected ? ` · ${selected.hint}` : ''}
          </span>
          <input type="hidden" name="averageWeightGram" value={estGram} />
        </div>
        <label className="field">
          <span>Biaya per ekor (opsional)</span>
          <input name="unitCost" type="number" min={0} step="any" disabled={busy} />
        </label>
        <label className="field">
          <span>Total biaya (opsional)</span>
          <input name="totalCost" type="number" min={0} step="any" disabled={busy} />
        </label>
        <label className="field">
          <span>Tanggal penebaran benih</span>
          <input
            name="stockDate"
            type="date"
            required
            disabled={busy}
            value={stockDate}
            onChange={(e) => setStockDate(e.target.value)}
          />
          <span className="field-help">Default hari ini. Bukan log harian — ini tanggal tebar resmi.</span>
        </label>
        <label className="field full">
          <span>Catatan</span>
          <input name="notes" disabled={busy} />
        </label>
        <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Batal</button>
        </div>
      </form>
    </section>
  );
}
