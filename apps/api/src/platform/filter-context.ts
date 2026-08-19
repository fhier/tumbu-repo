// @ts-nocheck
/**
 * Filter Context / Configuration Layer — TANPA kolom Prisma baru.
 * Disimpan di Tenant.settingsJson.allowedSpecies (string[] kode spesies).
 * Siap dipakai Single Species vs Multi-Species add-on.
 */

export type SpeciesOption = { code: string; label: string };

/** Opsi onboarding / lisensi spesies utama (selaras katalog budidaya). */
export const SPECIES_LICENSE_OPTIONS: SpeciesOption[] = [
  { code: 'LELE', label: 'Lele' },
  { code: 'NILA', label: 'Nila' },
  { code: 'NILA_MERAH', label: 'Nila Merah' },
  { code: 'NILA_HITAM', label: 'Nila Hitam' },
  { code: 'GURAME', label: 'Gurame' },
  { code: 'PATIN', label: 'Patin' },
  { code: 'MAS', label: 'Mas' },
  { code: 'BAWAL', label: 'Bawal' },
  { code: 'NILEM', label: 'Nilem' },
  { code: 'GABUS', label: 'Gabus' },
];

export function normalizeSpeciesCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Map label bebas (ERP) → kode kanonik bila dikenal. */
export function speciesCodeFromLabel(label: unknown): string {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const asCode = normalizeSpeciesCode(raw);
  if (SPECIES_LICENSE_OPTIONS.some((o) => o.code === asCode)) return asCode;
  const lower = raw.toLowerCase();
  const hit = SPECIES_LICENSE_OPTIONS.find(
    (o) => o.label.toLowerCase() === lower || lower.includes(o.label.toLowerCase()),
  );
  return hit?.code || asCode;
}

export function parseAllowedSpecies(settingsJson: string | null | undefined): string[] {
  try {
    const s = JSON.parse(settingsJson || '{}') as { allowedSpecies?: unknown };
    if (!Array.isArray(s.allowedSpecies)) return [];
    return [...new Set(
      s.allowedSpecies
        .map((x) => normalizeSpeciesCode(x))
        .filter(Boolean),
    )];
  } catch {
    return [];
  }
}

export function parseAllowedSpeciesFromObject(settings: Record<string, unknown> | null | undefined): string[] {
  if (!settings || !Array.isArray(settings.allowedSpecies)) return [];
  return [...new Set(
    settings.allowedSpecies
      .map((x) => normalizeSpeciesCode(x))
      .filter(Boolean),
  )];
}

/** Kosong = tidak memfilter (backward compatible / multi-species penuh). */
export function isSpeciesAllowed(codeOrLabel: unknown, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const code = speciesCodeFromLabel(codeOrLabel);
  if (!code) return true;
  return allowed.includes(code)
    || allowed.some((a) => code.startsWith(a) || a.startsWith(code));
}

export function filterByAllowedSpecies<T>(
  rows: T[],
  allowed: string[],
  getCodeOrLabel: (row: T) => unknown,
): T[] {
  if (!allowed.length) return rows;
  return rows.filter((r) => isSpeciesAllowed(getCodeOrLabel(r), allowed));
}

export function filterSpeciesLabelOptions(labels: readonly string[] | string[], allowed: string[]): string[] {
  if (!allowed.length) return [...labels];
  const filtered = labels.filter((l) => isSpeciesAllowed(l, allowed));
  return filtered.length ? filtered : [...labels];
}

/** Nama SKU dashboard — cegah "Benih 5-6 cm 5-6 cm". */
export function formatStockSkuName(name: unknown, sizeLabel?: unknown): string {
  const n = String(name || '').trim();
  const size = String(sizeLabel || '').trim();
  if (!size) return n;
  if (!n) return size;
  if (n.toLowerCase().includes(size.toLowerCase())) return n;
  return `${n} ${size}`.trim();
}

