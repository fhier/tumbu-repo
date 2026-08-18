'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Ti } from './icons';

export const moneyFmt = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export type TxSummaryItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'green' | 'teal' | 'purple' | 'red' | 'navy';
};

type TxModulePageProps = {
  title: string;
  breadcrumb?: string;
  hint?: string;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  summary: TxSummaryItem[];
  toolbar?: ReactNode;
  /** Judul blok daftar di dalam kartu (toolbar ikut masuk kartu). */
  listTitle?: string;
  /** Panel sekunder di bawah kartu utama (form/aksi yang sudah ada). */
  footer?: ReactNode;
  bare?: boolean;
  /** Sembunyikan header judul (mis. digabung ke plat-hero). */
  hideHead?: boolean;
  children: ReactNode;
};

/** Shell halaman transaksi — bahasa desain sama Dashboard. */
export function TxModulePage({
  title, breadcrumb, hint, onRefresh, onAdd, addLabel = '+ Tambah Baru', summary, toolbar, listTitle, footer, bare, hideHead, children,
}: TxModulePageProps) {
  const kpiCount = Math.min(Math.max(summary.length, 1), 6);
  const listShell = (body: ReactNode) => (
    <section className="txm-table-card txm-list-shell">
      {(listTitle || toolbar) ? (
        <div className="txm-list-head">
          {listTitle ? <h3 className="txm-list-title">{listTitle}</h3> : <span />}
          {toolbar ? <div className="txm-toolbar txm-toolbar--in-card">{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="txm-list-body">{body}</div>
    </section>
  );

  const mainBody = bare
    ? (listTitle || toolbar ? listShell(children) : children)
    : listShell(children);

  return (
    <div className="txm">
      {!hideHead ? (
        <header className="txm-head">
          <div className="txm-head-copy">
            {breadcrumb ? <p className="txm-crumb">{breadcrumb}</p> : null}
            <h2>{title}</h2>
            {hint ? <p className="txm-hint">{hint}</p> : null}
          </div>
          <div className="txm-head-actions">
            {onRefresh ? (
              <button type="button" className="btn-secondary btn-sm" onClick={onRefresh}>Muat ulang</button>
            ) : null}
            {onAdd ? (
              <button type="button" className="txm-btn-primary" onClick={onAdd}>{addLabel}</button>
            ) : null}
          </div>
        </header>
      ) : null}

      {summary.length > 0 ? (
        <div className={`txm-summary txm-summary--n${kpiCount}`}>
          {summary.map((s) => (
            <article key={s.label} className={`txm-sum-card tone-${s.tone || 'navy'}`}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              {s.hint ? <small>{s.hint}</small> : null}
            </article>
          ))}
        </div>
      ) : null}

      {mainBody}

      {footer ? <div className="txm-bottom">{footer}</div> : null}
    </div>
  );
}

type TxDrawerProps = {
  open: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  summary?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

/** Drawer kanan — satu form scroll, ringkasan + aksi di footer (tanpa wizard). */
export function TxDrawer({
  open, title, hint, onClose, summary, footer, children,
}: TxDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="txm-drawer-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="txm-drawer-backdrop" aria-label="Tutup" onClick={onClose} />
      <aside className="txm-drawer">
        <header className="txm-drawer-head">
          <div>
            <h3>{title}</h3>
            {hint ? <p className="txm-hint">{hint}</p> : null}
          </div>
          <button type="button" className="txm-drawer-x" aria-label="Tutup" onClick={onClose}>✕</button>
        </header>

        <div className="txm-drawer-body">{children}</div>

        <footer className="txm-drawer-foot">
          {summary ? <div className="txm-drawer-foot-sum">{summary}</div> : null}
          {footer ? <div className="txm-drawer-foot-actions">{footer}</div> : null}
        </footer>
      </aside>
    </div>
  );
}

/** Bagian form (judul visual saja — semua field tetap terlihat). */
export function TxSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="txm-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

/** Tombol aksi ikon — hemat ruang, konsisten acuan Platform. `showLabel` untuk aksi kritis (Setujui/Tolak). */
export function TxIconBtn({
  icon, label, onClick, danger, pay, disabled, showLabel,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  pay?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className={`txm-ico${showLabel ? ' has-label' : ''}${danger ? ' is-danger' : ''}${pay ? ' is-pay' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Ti name={icon} size={15} />
      {showLabel ? <span className="txm-ico-label">{label}</span> : null}
    </button>
  );
}

export function useClientPager<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    page: safePage,
    setPage,
    totalPages,
    slice,
    from: rows.length ? (safePage - 1) * pageSize + 1 : 0,
    to: Math.min(safePage * pageSize, rows.length),
    total: rows.length,
  };
}

export function TxPager({
  page, totalPages, from, to, total, onPage,
}: {
  page: number; totalPages: number; from: number; to: number; total: number;
  onPage: (p: number) => void;
}) {
  if (total <= 0) return null;
  return (
    <div className="txm-pager">
      <span>{from}–{to} dari {total}</span>
      <div className="txm-pager-btns">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
        <em>{page} / {totalPages}</em>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Berikutnya</button>
      </div>
    </div>
  );
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printHtmlTable(title: string, headers: string[], rows: string[][]) {
  const w = window.open('', '_blank');
  if (!w) return;
  const th = headers.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#F1F5F9}</style></head>
    <body><h1>${title}</h1><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
