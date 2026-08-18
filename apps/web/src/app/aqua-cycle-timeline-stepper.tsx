'use client';

import { fmtWhen } from './aqua-shared';

export type TimelineStepItem = {
  key: string;
  kind: string;
  label: string;
  at: string;
  detail: string;
  status?: string;
  voidable?: { type: 'feed' | 'harvest'; id: string };
};

const NODE_CLASS: Record<string, string> = {
  PLANNED: 'node-planned',
  READY: 'node-ready',
  STOCKING: 'node-active',
  FEED: 'node-active',
  MORTALITY: 'node-warn',
  SAMPLING: 'node-active',
  HARVEST: 'node-harvest',
  CLOSE: 'node-closed',
  CANCELLED: 'node-cancelled',
};

export function AquaCycleTimelineStepper({
  items,
  manage,
  busy,
  onVoid,
}: {
  items: TimelineStepItem[];
  manage?: boolean;
  busy?: boolean;
  onVoid?: (type: 'feed' | 'harvest', id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="empty-state">Belum ada riwayat. Mulai dengan menandai siap tebar, lalu catat tebar.</p>
    );
  }

  return (
    <ol className="aqua-timeline-stepper">
      {items.map((item, i) => {
        const nodeClass = NODE_CLASS[item.kind] || 'node-default';
        const isLast = i === items.length - 1;
        const voided = item.status === 'VOIDED';
        return (
          <li
            key={item.key}
            className={`aqua-tl-step ${nodeClass}${voided ? ' is-voided' : ''}${isLast ? ' is-last' : ''}`}
          >
            <div className="aqua-tl-step-track">
              <span className="aqua-tl-step-node" aria-hidden="true" />
              {!isLast ? <span className="aqua-tl-step-line" aria-hidden="true" /> : null}
            </div>
            <div className="aqua-tl-step-body">
              <div className="aqua-tl-step-head">
                <strong>{item.label}</strong>
                <time>{item.at ? fmtWhen(item.at) : '—'}</time>
              </div>
              <p>{item.detail}</p>
              {item.voidable && manage && !voided && onVoid ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => onVoid(item.voidable!.type, item.voidable!.id)}
                >
                  Batalkan catatan
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
