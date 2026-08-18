'use client';

import { CYCLE_STATUS_FILTERS, type CycleStatusFilter } from './aqua-cycle-target-calc';

export function CycleStatusFilterPills({
  value,
  onChange,
}: {
  value: CycleStatusFilter;
  onChange: (v: CycleStatusFilter) => void;
}) {
  return (
    <div className="cycle-status-pills" role="tablist" aria-label="Filter status siklus">
      {CYCLE_STATUS_FILTERS.map((f) => (
        <button
          key={f.id || 'all'}
          type="button"
          role="tab"
          aria-selected={value === f.id}
          className={`cycle-status-pill${value === f.id ? ' is-active' : ''}`}
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
