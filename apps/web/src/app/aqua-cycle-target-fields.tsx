'use client';

import { useEffect, useMemo, useState } from 'react';
import { targetCalcBreakdown } from './aqua-cycle-target-calc';
import {
  DEFAULT_SELL_PRICE_PER_KG,
  PROFIT_WARNING_TEXT,
  computeProfitAdvisor,
} from './aqua-profit-advisor';
import { money } from './aqua-shared';

function EditableAutoField({
  label,
  name,
  autoValue,
  editing,
  onToggleEdit,
  manualValue,
  onManualChange,
  disabled,
}: {
  label: string;
  name: string;
  autoValue: string;
  editing: boolean;
  onToggleEdit: () => void;
  manualValue: string;
  onManualChange: (v: string) => void;
  disabled?: boolean;
}) {
  const display = editing ? manualValue : autoValue;
  return (
    <label className="field">
      <div className="field-label-row">
        <span>{label}</span>
        <button
          type="button"
          className={`field-edit-btn${editing ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={onToggleEdit}
          aria-pressed={editing}
        >
          ✏️ {editing ? 'Kunci otomatis' : 'Edit manual'}
        </button>
      </div>
      <input
        name={name}
        type="number"
        min={0}
        step="any"
        readOnly={!editing}
        disabled={disabled || !editing}
        value={display}
        onChange={(e) => onManualChange(e.target.value)}
        className={!editing ? 'field-readonly' : undefined}
      />
    </label>
  );
}

export function AquaCycleTargetFields({
  seedCount,
  targetSrPct,
  targetWeightGram,
  targetFcr,
  seedUnitCost,
  feedPricePerKg,
  operasionalCost,
  sellPricePerKg: sellPriceProp,
  initialHarvestKg,
  initialBopRp,
  disabled,
  showSellPriceInput = true,
  locked = false,
}: {
  seedCount: number;
  targetSrPct: number;
  targetWeightGram: number;
  targetFcr: number;
  seedUnitCost: number;
  feedPricePerKg: number;
  operasionalCost: number;
  sellPricePerKg?: number;
  initialHarvestKg?: number | null;
  initialBopRp?: number | null;
  disabled?: boolean;
  showSellPriceInput?: boolean;
  /** Starter — blur Profit Advisor */
  locked?: boolean;
}) {
  const calc = useMemo(
    () => targetCalcBreakdown({
      seedCount,
      targetSrPct,
      targetWeightGram,
      targetFcr,
      seedUnitCost,
      feedPricePerKg,
      operasionalCost,
    }),
    [seedCount, targetSrPct, targetWeightGram, targetFcr, seedUnitCost, feedPricePerKg, operasionalCost],
  );

  const [overrideHarvest, setOverrideHarvest] = useState(false);
  const [overrideBop, setOverrideBop] = useState(false);
  const [harvestManual, setHarvestManual] = useState(
    initialHarvestKg != null ? String(initialHarvestKg) : '',
  );
  const [bopManual, setBopManual] = useState(
    initialBopRp != null ? String(initialBopRp) : '',
  );
  const [sellPricePerKg, setSellPricePerKg] = useState(
    String(sellPriceProp ?? DEFAULT_SELL_PRICE_PER_KG),
  );

  const autoHarvest = calc.harvestKg != null ? String(calc.harvestKg) : '';
  const autoBop = calc.bopRp != null ? String(calc.bopRp) : '';

  useEffect(() => {
    if (!overrideHarvest && autoHarvest) setHarvestManual(autoHarvest);
  }, [autoHarvest, overrideHarvest]);

  useEffect(() => {
    if (!overrideBop && autoBop) setBopManual(autoBop);
  }, [autoBop, overrideBop]);

  const harvestKgNum = overrideHarvest
    ? Number(harvestManual) || null
    : calc.harvestKg;
  const bopNum = overrideBop ? Number(bopManual) || null : calc.bopRp;

  const profit = useMemo(
    () => computeProfitAdvisor({
      harvestKg: harvestKgNum,
      bopRp: bopNum,
      sellPricePerKg: Number(sellPricePerKg) || DEFAULT_SELL_PRICE_PER_KG,
    }),
    [harvestKgNum, bopNum, sellPricePerKg],
  );

  return (
    <>
      <EditableAutoField
        label="Target panen (kg)"
        name="targetHarvestKg"
        autoValue={autoHarvest}
        editing={overrideHarvest}
        manualValue={harvestManual}
        onManualChange={setHarvestManual}
        onToggleEdit={() => {
          if (!overrideHarvest && autoHarvest) setHarvestManual(autoHarvest);
          setOverrideHarvest((v) => !v);
        }}
        disabled={disabled}
      />
      <EditableAutoField
        label="Target BOP (Rp)"
        name="targetBopAmount"
        autoValue={autoBop}
        editing={overrideBop}
        manualValue={bopManual}
        onManualChange={setBopManual}
        onToggleEdit={() => {
          if (!overrideBop && autoBop) setBopManual(autoBop);
          setOverrideBop((v) => !v);
        }}
        disabled={disabled}
      />

      <div className="cycle-estimate-card target-calc-helper" style={{ gridColumn: '1 / -1' }}>
        <h3>Rincian kalkulasi otomatis</h3>
        <ul className="target-calc-list">
          <li>
            <strong>Target panen</strong> = Jumlah tebar × (SR ÷ 100) × berat target (g) ÷ 1000
            <br />
            <span className="hint">
              {seedCount.toLocaleString('id-ID')} × ({targetSrPct}% ) × {targetWeightGram} g ÷ 1000
              {calc.survivePcs != null ? ` → ~${calc.harvestKg?.toLocaleString('id-ID')} kg (${calc.survivePcs.toLocaleString('id-ID')} ekor hidup)` : ''}
            </span>
          </li>
          <li>
            <strong>Kebutuhan pakan</strong> = Jumlah tebar × FCR × berat target (kg)
            <br />
            <span className="hint">
              {calc.feedKg != null ? `~${calc.feedKg.toLocaleString('id-ID')} kg` : '—'}
            </span>
          </li>
          <li>
            <strong>Target BOP</strong> = Biaya benih + (pakan kg × harga/kg) + operasional
            <br />
            <span className="hint">
              {money(calc.biayaBenih)} + {money(calc.biayaPakan)} + {money(calc.operasional)}
              {calc.bopRp != null ? ` = ${money(calc.bopRp)}` : ''}
            </span>
          </li>
        </ul>

        {showSellPriceInput ? (
          <label className="field" style={{ marginTop: 12, maxWidth: 280 }}>
            <span>Estimasi harga jual pasar (Rp/kg)</span>
            <input
              type="number"
              min={0}
              disabled={disabled}
              value={sellPricePerKg}
              onChange={(e) => setSellPricePerKg(e.target.value)}
            />
          </label>
        ) : null}

        {profit ? (
          <div className="profit-advisor-block">
            <div className="profit-advisor-head" style={{ marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Tumbu Profit Advisor</h4>
              {locked ? <span className="plan-pro-badge">Fitur Pro</span> : null}
            </div>
            <div className={locked ? 'plan-lock-blur' : undefined}>
            <p className="hint" style={{ marginTop: 0 }}>
              Estimasi penjualan = {profit.harvestKg.toLocaleString('id-ID')} kg × {money(profit.sellPricePerKg)}/kg
              = <b>{money(profit.estimatedRevenue)}</b>
              {' · '}
              Margin = {money(profit.estimatedRevenue)} − {money(profit.bopRp)} = <b>{money(profit.margin)}</b>
            </p>
            {profit.healthy ? (
              <div className="profit-advisor-badge profit-advisor-ok">
                🟢 Rencana Budidaya Sehat (Estimasi Profit: {money(profit.margin)})
              </div>
            ) : (
              <div className="profit-advisor-badge profit-advisor-warn" role="alert">
                ⚠️ {PROFIT_WARNING_TEXT}
              </div>
            )}
            </div>
            {locked ? (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Upgrade ke Paket Pro untuk membuka analisis margin penuh.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
