'use client';

import { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'warning';

export type ToastNotice = {
  id: number;
  text: string;
  kind: ToastKind;
};

const TOAST_MS = 5000;

/** Floating toast — top-right, auto-dismiss 5s, progress bar. */
export function ToastHost({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!notice) return;
    setLeaving(false);
    const leaveAt = window.setTimeout(() => setLeaving(true), TOAST_MS - 280);
    const gone = window.setTimeout(() => onDismiss(), TOAST_MS);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(gone);
    };
  }, [notice?.id, onDismiss]);

  if (!notice) return null;

  const icon = notice.kind === 'error' ? '✕' : notice.kind === 'warning' ? '!' : '✓';

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      <div
        className={`toast toast-${notice.kind}${leaving ? ' is-leaving' : ''}`}
        role="status"
      >
        <span className="toast-ico" aria-hidden="true">{icon}</span>
        <p className="toast-text">{notice.text}</p>
        <button
          type="button"
          className="toast-close"
          aria-label="Tutup notifikasi"
          onClick={onDismiss}
        >
          ×
        </button>
        <span className="toast-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
