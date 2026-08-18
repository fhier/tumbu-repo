'use client';

import { useEffect, useRef, useState } from 'react';

/** Dropdown workspace gelap — mengganti native select yang abu-abu jelek. */
export function WorkspaceSwitch({
  workspaces,
  value,
  onChange,
}: {
  workspaces: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = workspaces.find((w) => w.id === value) || workspaces[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (workspaces.length < 2) return null;

  return (
    <div className={`ws-dd${open ? ' is-open' : ''}`} ref={root}>
      <button
        type="button"
        className="ws-dd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ws-dd-label">{current?.name || 'Pilih usaha'}</span>
        <svg className="ws-dd-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul className="ws-dd-menu" role="listbox">
          {workspaces.map((w) => (
            <li key={w.id} role="option" aria-selected={w.id === value}>
              <button
                type="button"
                className={w.id === value ? 'is-active' : ''}
                onClick={() => {
                  setOpen(false);
                  if (w.id !== value) onChange(w.id);
                }}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
