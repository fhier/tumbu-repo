'use client';

/** Tren 7 hari — SVG line chart (warna sama acuan Apps Script). */
export function TrendChart({
  rows,
}: {
  rows: Array<{ tanggal: string; pembelian: number; penjualan: number }>;
}) {
  const w = 640;
  const h = 200;
  const pad = { t: 28, r: 16, b: 34, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const data = rows.length ? rows : Array.from({ length: 7 }, (_, i) => ({
    tanggal: `H-${6 - i}`, pembelian: 0, penjualan: 0,
  }));
  const maxY = Math.max(1, ...data.flatMap((d) => [d.pembelian, d.penjualan]));
  const xAt = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const yAt = (v: number) => pad.t + ih - (v / maxY) * ih;
  const pathFor = (key: 'pembelian' | 'penjualan') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');

  return (
    <div className="dash-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Tren pembelian vs penjualan"
      >
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + ih * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={pad.l - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8">
                {t === 0 ? '0' : t === 1 ? shortRp(maxY) : shortRp(maxY / 2)}
              </text>
            </g>
          );
        })}
        <path d={pathFor('pembelian')} fill="none" stroke="#1E9E43" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathFor('penjualan')} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.tanggal + i}>
            <circle cx={xAt(i)} cy={yAt(d.pembelian)} r="3.5" fill="#1E9E43" />
            <circle cx={xAt(i)} cy={yAt(d.penjualan)} r="3.5" fill="#2563EB" />
            <text x={xAt(i)} y={h - 14} textAnchor="middle" fontSize="10" fill="#64748B">{d.tanggal}</text>
          </g>
        ))}
        <g transform={`translate(${pad.l}, 14)`}>
          <rect x="0" y="-6" width="10" height="3" rx="1" fill="#1E9E43" />
          <text x="14" y="0" fontSize="11" fill="#334155">Pembelian</text>
          <rect x="90" y="-6" width="10" height="3" rx="1" fill="#2563EB" />
          <text x="104" y="0" fontSize="11" fill="#334155">Penjualan</text>
        </g>
      </svg>
    </div>
  );
}

const PIE_COLORS = ['#0A2E63', '#1E9E43', '#2E86C1', '#58D68D', '#F4B400', '#D9534F', '#8E44AD', '#16A085'];

/** Donut stok — mengikuti pieHole 0.4 acuan Apps Script. */
export function StockPie({
  rows,
}: {
  rows: Array<{ label: string; value: number }>;
}) {
  const positive = rows.filter((r) => r.value > 0).slice(0, 8);
  if (!positive.length) {
    return <p className="hint" style={{ margin: '8px 0' }}>Grafik pie tidak ditampilkan bila tidak ada stok positif.</p>;
  }
  const total = positive.reduce((s, r) => s + r.value, 0);
  const size = 200;
  const cx = 100;
  const cy = 100;
  const r = 78;
  const rInner = 78 * 0.4;
  let angle = -Math.PI / 2;
  const slices = positive.map((row, i) => {
    const sweep = (row.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    return { ...row, color: PIE_COLORS[i % PIE_COLORS.length], d: donutPath(cx, cy, r, rInner, a0, a1) };
  });

  return (
    <div className="dash-pie">
      <svg viewBox={`0 0 ${size} ${size}`} width={180} height={180} role="img" aria-label="Komposisi stok">
        {slices.map((s) => (
          <path key={s.label} d={s.d} fill={s.color} />
        ))}
      </svg>
      <ul className="dash-pie-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{s.value.toLocaleString('id-ID')}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortRp(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}rb`;
  return String(Math.round(n));
}

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function donutPath(cx: number, cy: number, r: number, rInner: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const q0 = polar(cx, cy, rInner, a1);
  const q1 = polar(cx, cy, rInner, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${q0.x} ${q0.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${q1.x} ${q1.y}`,
    'Z',
  ].join(' ');
}
