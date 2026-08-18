'use client';

/**
 * Grafik analytics siklus — tren tebar, akumulasi pakan, mortalitas (UX derived dari events).
 */

type Point = { label: string; stocking: number; feedKg: number; mortality: number };

function buildSeries(events: {
  stocking?: Array<Record<string, unknown>>;
  feeds?: Array<Record<string, unknown>>;
  mortalities?: Array<Record<string, unknown>>;
} | null, startedAt?: string | null): Point[] {
  if (!events) return [];
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const buckets = new Map<string, { stocking: number; feedKg: number; mortality: number }>();

  const add = (key: string, patch: Partial<{ stocking: number; feedKg: number; mortality: number }>) => {
    const cur = buckets.get(key) || { stocking: 0, feedKg: 0, mortality: 0 };
    buckets.set(key, {
      stocking: cur.stocking + (patch.stocking || 0),
      feedKg: cur.feedKg + (patch.feedKg || 0),
      mortality: cur.mortality + (patch.mortality || 0),
    });
  };

  for (const s of events.stocking || []) {
    if (String(s.recordStatus || 'RECORDED') === 'VOIDED') continue;
    const k = dayKey(String(s.eventAt || s.createdAt || ''));
    if (k) add(k, { stocking: Number(s.quantityPcs || 0) });
  }
  for (const f of events.feeds || []) {
    if (String(f.recordStatus || 'RECORDED') === 'VOIDED') continue;
    const k = dayKey(String(f.eventAt || f.createdAt || ''));
    if (k) add(k, { feedKg: Number(f.quantityKg || 0) });
  }
  for (const m of events.mortalities || []) {
    if (String(m.recordStatus || 'RECORDED') === 'VOIDED') continue;
    const k = dayKey(String(m.eventAt || m.createdAt || ''));
    if (k) add(k, { mortality: Number(m.deadCountPcs || 0) });
  }

  const keys = [...buckets.keys()].sort();
  if (!keys.length && startedAt) {
    keys.push(dayKey(startedAt));
    buckets.set(keys[0], { stocking: 0, feedKg: 0, mortality: 0 });
  }

  let cumStock = 0;
  let cumFeed = 0;
  let cumMort = 0;

  return keys.map((k) => {
    const b = buckets.get(k)!;
    cumStock += b.stocking;
    cumFeed += b.feedKg;
    cumMort += b.mortality;
    const d = new Date(k);
    const label = Number.isNaN(d.getTime())
      ? k
      : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return { label, stocking: cumStock, feedKg: Math.round(cumFeed * 10) / 10, mortality: cumMort };
  });
}

export function AquaCycleAnalyticsChart({
  events,
  startedAt,
}: {
  events: {
    stocking?: Array<Record<string, unknown>>;
    feeds?: Array<Record<string, unknown>>;
    mortalities?: Array<Record<string, unknown>>;
  } | null;
  startedAt?: string | null;
}) {
  const data = buildSeries(events, startedAt);
  const w = 640;
  const h = 220;
  const pad = { t: 32, r: 16, b: 36, l: 48 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  if (!data.length) {
    return (
      <p className="hint" style={{ margin: '12px 0' }}>
        Belum ada data tebar/pakan/mortalitas untuk ditampilkan. Mulai siklus dan catat kejadian.
      </p>
    );
  }

  const maxY = Math.max(
    1,
    ...data.flatMap((d) => [d.stocking, d.feedKg, d.mortality]),
  );
  const xAt = (i: number) =>
    pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const yAt = (v: number) => pad.t + ih - (v / maxY) * ih;

  const pathFor = (key: keyof Pick<Point, 'stocking' | 'feedKg' | 'mortality'>) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');

  return (
    <div className="dash-chart aqua-cycle-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Grafik analytics siklus">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + ih * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8">
                {t === 0 ? '0' : Math.round(maxY * t).toLocaleString('id-ID')}
              </text>
            </g>
          );
        })}
        <path d={pathFor('stocking')} fill="none" stroke="#0A2E63" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={pathFor('feedKg')} fill="none" stroke="#1E9E43" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={pathFor('mortality')} fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6 4" />
        {data.map((d, i) => (
          <text key={d.label + i} x={xAt(i)} y={h - 12} textAnchor="middle" fontSize="9" fill="#64748B">
            {d.label}
          </text>
        ))}
        <g transform={`translate(${pad.l}, 12)`}>
          <rect x="0" y="-5" width="10" height="3" fill="#0A2E63" />
          <text x="14" y="0" fontSize="10" fill="#334155">Akum. Tebar (ekor)</text>
          <rect x="130" y="-5" width="10" height="3" fill="#1E9E43" />
          <text x="144" y="0" fontSize="10" fill="#334155">Akum. Pakan (kg)</text>
          <rect x="270" y="-5" width="10" height="3" fill="#DC2626" />
          <text x="284" y="0" fontSize="10" fill="#334155">Kematian (ekor)</text>
        </g>
      </svg>
    </div>
  );
}
