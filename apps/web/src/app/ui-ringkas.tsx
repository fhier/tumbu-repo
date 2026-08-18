'use client';

import { ReactNode } from 'react';

/** Live ringkasan panel — pola sama dengan Berita Acara. */
export function RingkasCard({ title, rows, badge, hint }: {
  title: string;
  rows: Array<{ label: string; value: string; tone?: 'loss' | 'profit' | 'muted' }>;
  badge?: ReactNode;
  hint?: string;
}) {
  return (
    <section className="panel ringkas-panel">
      <h2>{title}</h2>
      {badge ? <div style={{ marginBottom: 12 }}>{badge}</div> : null}
      <div className="ringkas-list">
        {rows.map((r) => (
          <div key={r.label} className="ringkas-row">
            <span>{r.label}</span>
            <strong className={r.tone || ''}>{r.value}</strong>
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        {hint || 'Ringkasan mengikuti isian form secara langsung — sama pola Berita Acara.'}
      </p>
    </section>
  );
}
