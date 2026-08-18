'use client';

import { useState } from 'react';
import {
  DEFAULT_SELL_PRICE_PER_KG,
  PROFIT_WARNING_TEXT,
  computeProfitAdvisor,
} from './aqua-profit-advisor';
import { PLAN_UPGRADE_MESSAGES } from './plan-limits';
import { money } from './aqua-shared';

export function AquaProfitAdvisorCard({
  harvestKg,
  bopRp,
  disabled,
  compact,
  locked,
}: {
  harvestKg?: number | null;
  bopRp?: number | null;
  disabled?: boolean;
  compact?: boolean;
  /** Starter package — blur content + Fitur Pro badge */
  locked?: boolean;
}) {
  const [sellPricePerKg, setSellPricePerKg] = useState(String(DEFAULT_SELL_PRICE_PER_KG));
  const profit = computeProfitAdvisor({
    harvestKg: harvestKg != null ? Number(harvestKg) : null,
    bopRp: bopRp != null ? Number(bopRp) : null,
    sellPricePerKg: Number(sellPricePerKg) || DEFAULT_SELL_PRICE_PER_KG,
  });

  const body = (
    <>
      {!compact ? (
        <p className="hint">
          Estimasi kesehatan margin berdasarkan target panen, BOP, dan harga jual pasar.
        </p>
      ) : null}
      {harvestKg == null || !(Number(harvestKg) > 0) || bopRp == null ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Isi rencana target panen & BOP di siklus untuk melihat estimasi margin sebelum panen.
        </p>
      ) : (
        <>
          <div className="profit-advisor-toolbar">
            <label className="field" style={{ margin: 0, maxWidth: 260 }}>
              <span>Estimasi harga jual (Rp/kg)</span>
              <input
                type="number"
                min={0}
                disabled={disabled || locked}
                value={sellPricePerKg}
                onChange={(e) => setSellPricePerKg(e.target.value)}
              />
            </label>
          </div>
          {profit ? (
            <>
              <p className="hint profit-advisor-math">
                Estimasi penjualan {money(profit.estimatedRevenue)} − BOP {money(profit.bopRp)} ={' '}
                <b>{money(profit.margin)}</b>
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
            </>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <section className={`panel profit-advisor-panel${locked ? ' is-plan-locked' : ''}`}>
      <div className="profit-advisor-head">
        <h2>Tumbu Profit Advisor</h2>
        {locked ? <span className="plan-pro-badge">Fitur Pro</span> : null}
      </div>
      <div className={locked ? 'plan-lock-blur' : undefined} aria-hidden={locked || undefined}>
        {body}
      </div>
      {locked ? (
        <div className="plan-lock-overlay" role="status">
          <p>{PLAN_UPGRADE_MESSAGES.profitAdvisor}</p>
          <small>Upgrade ke Paket Pro untuk membuka analisis margin penuh.</small>
        </div>
      ) : null}
    </section>
  );
}
