import React from 'react';

interface MetricBadgeProps {
  status: 'good' | 'warning' | 'critical';
  children: React.ReactNode;
}

/**
 * High‑contrast badge used for metric status display.
 * Colors follow WCAG‑AA compliant Tailwind palette as per user spec.
 */
export const MetricBadge: React.FC<MetricBadgeProps> = ({ status, children }) => {
  const baseClasses = 'inline-block px-2 py-1 rounded border text-sm font-medium';
  const variants: Record<MetricBadgeProps['status'], string> = {
    good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  };
  return <span className={`${baseClasses} ${variants[status]}`}>{children}</span>;
};

export default MetricBadge;
