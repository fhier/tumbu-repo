import React from 'react';

interface MonospaceValueProps {
  value: number;
  unit?: string; // e.g., 'kg', 'FCR', 'Rp'
}

/**
 * Formats a numeric metric with optional unit and applies a monospace font.
 * Uses Intl.NumberFormat for thousand separators.
 */
export const MonospaceValue: React.FC<MonospaceValueProps> = ({ value, unit }) => {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
  return <span className="font-mono">{formatted}{unit ? ` ${unit}` : ''}</span>;
};

export default MonospaceValue;
