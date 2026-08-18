'use client';

import { FormEvent, useState } from 'react';
import { AquaCycleTargetFields } from './aqua-cycle-target-fields';

type CycleTargetPanelProps = {
  cycle: {
    id: string;
    targetFcr?: number | string | null;
    targetSrPct?: number | string | null;
    targetDays?: number | null;
    targetWeightGram?: number | string | null;
    targetHarvestKg?: number | string | null;
    targetBopAmount?: number | string | null;
  };
  defaultSeedCount: number;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  profitAdvisorLocked?: boolean;
};

export function CycleTargetPanel({
  cycle,
  defaultSeedCount,
  busy,
  onSubmit,
  profitAdvisorLocked = false,
}: CycleTargetPanelProps) {
  const [targetFcr, setTargetFcr] = useState(cycle.targetFcr != null ? String(cycle.targetFcr) : '');
  const [targetSrPct, setTargetSrPct] = useState(cycle.targetSrPct != null ? String(cycle.targetSrPct) : '');
  const [targetDays, setTargetDays] = useState(cycle.targetDays != null ? String(cycle.targetDays) : '');
  const [targetWeightGram, setTargetWeightGram] = useState(
    cycle.targetWeightGram != null ? String(cycle.targetWeightGram) : '100',
  );
  const [seedCount, setSeedCount] = useState(defaultSeedCount > 0 ? String(defaultSeedCount) : '');
  const [seedUnitCost, setSeedUnitCost] = useState('150');
  const [feedPricePerKg, setFeedPricePerKg] = useState('14500');
  const [operasionalCost, setOperasionalCost] = useState('500000');
  const [sellPricePerKg, setSellPricePerKg] = useState('26000');

  const seedN = Number(seedCount) || 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await onSubmit({
      targetFcr: f.get('targetFcr') ? Number(f.get('targetFcr')) : null,
      targetSrPct: f.get('targetSrPct') ? Number(f.get('targetSrPct')) : null,
      targetDays: f.get('targetDays') ? Number(f.get('targetDays')) : null,
      targetWeightGram: targetWeightGram ? Number(targetWeightGram) : null,
      targetHarvestKg: f.get('targetHarvestKg') ? Number(f.get('targetHarvestKg')) : null,
      targetBopAmount: f.get('targetBopAmount') ? Number(f.get('targetBopAmount')) : null,
    });
  };

  return (
    <form
      className="form form-2"
      style={{ marginTop: 16 }}
      onSubmit={(ev) => void handleSubmit(ev)}
    >
      <h3 style={{ gridColumn: '1 / -1', margin: '0 0 4px' }}>Rencana & Target Budidaya</h3>
      <p className="hint" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
        Target panen & BOP dihitung otomatis. Klik ✏️ Edit manual bila perlu menyesuaikan angka.
      </p>
      <label className="field">
        <span>Jumlah tebar (ekor) — untuk kalkulasi</span>
        <input
          type="number"
          min={0}
          disabled={busy}
          value={seedCount}
          onChange={(e) => setSeedCount(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Biaya benih per ekor (Rp)</span>
        <input type="number" min={0} disabled={busy} value={seedUnitCost} onChange={(e) => setSeedUnitCost(e.target.value)} />
      </label>
      <label className="field">
        <span>Target FCR</span>
        <input name="targetFcr" type="number" min={0} step="any" disabled={busy} value={targetFcr} onChange={(e) => setTargetFcr(e.target.value)} />
      </label>
      <label className="field">
        <span>Target SR (%)</span>
        <input name="targetSrPct" type="number" min={0} max={100} step="any" disabled={busy} value={targetSrPct} onChange={(e) => setTargetSrPct(e.target.value)} />
      </label>
      <label className="field">
        <span>Target hari</span>
        <input name="targetDays" type="number" min={0} disabled={busy} value={targetDays} onChange={(e) => setTargetDays(e.target.value)} />
      </label>
      <label className="field">
        <span>Berat target panen (g/ekor)</span>
        <input type="number" min={0} disabled={busy} value={targetWeightGram} onChange={(e) => setTargetWeightGram(e.target.value)} />
      </label>
      <label className="field">
        <span>Harga pakan (Rp/kg)</span>
        <input type="number" min={0} disabled={busy} value={feedPricePerKg} onChange={(e) => setFeedPricePerKg(e.target.value)} />
      </label>
      <label className="field">
        <span>Estimasi operasional (Rp)</span>
        <input type="number" min={0} disabled={busy} value={operasionalCost} onChange={(e) => setOperasionalCost(e.target.value)} />
      </label>
      <label className="field">
        <span>Estimasi harga jual pasar (Rp/kg)</span>
        <input type="number" min={0} disabled={busy} value={sellPricePerKg} onChange={(e) => setSellPricePerKg(e.target.value)} />
      </label>
      <AquaCycleTargetFields
        seedCount={seedN}
        targetSrPct={Number(targetSrPct) || 0}
        targetWeightGram={Number(targetWeightGram) || 0}
        targetFcr={Number(targetFcr) || 0}
        seedUnitCost={Number(seedUnitCost) || 0}
        feedPricePerKg={Number(feedPricePerKg) || 0}
        operasionalCost={Number(operasionalCost) || 0}
        sellPricePerKg={Number(sellPricePerKg) || 26000}
        initialHarvestKg={cycle.targetHarvestKg != null ? Number(cycle.targetHarvestKg) : null}
        initialBopRp={cycle.targetBopAmount != null ? Number(cycle.targetBopAmount) : null}
        disabled={busy}
        showSellPriceInput={false}
        locked={profitAdvisorLocked}
      />
      <div className="tb-actions" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" disabled={busy}>Simpan target</button>
      </div>
    </form>
  );
}
