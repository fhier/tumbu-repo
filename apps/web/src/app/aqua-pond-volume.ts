/** Kalkulator volume wadah/kolam — UX advisory; backend SSOT di master.service. */

export type PondShape = 'box' | 'round';

export type PondVolumeInput = {
  shape: PondShape;
  lengthM?: number | '';
  widthM?: number | '';
  diameterM?: number | '';
  depthM?: number | '';
};

export type PondVolumeResult = {
  areaM2: number | null;
  volumeM3: number | null;
  volumeLiter: number | null;
};

const num = (v: number | '' | undefined): number | null => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function computePondVolume(input: PondVolumeInput): PondVolumeResult {
  const depth = num(input.depthM);
  if (input.shape === 'round') {
    const d = num(input.diameterM);
    if (!d) return { areaM2: null, volumeM3: null, volumeLiter: null };
    const r = d / 2;
    const areaM2 = Math.round(Math.PI * r * r * 1000) / 1000;
    const volumeM3 =
      depth != null ? Math.round(0.25 * Math.PI * d * d * depth * 1000) / 1000 : null;
    const volumeLiter = volumeM3 != null ? Math.round(volumeM3 * 1000) : null;
    return { areaM2, volumeM3, volumeLiter };
  }
  const p = num(input.lengthM);
  const l = num(input.widthM);
  if (!p || !l) return { areaM2: null, volumeM3: null, volumeLiter: null };
  const areaM2 = Math.round(p * l * 1000) / 1000;
  const volumeM3 = depth != null ? Math.round(p * l * depth * 1000) / 1000 : null;
  const volumeLiter = volumeM3 != null ? Math.round(volumeM3 * 1000) : null;
  return { areaM2, volumeM3, volumeLiter };
}

export function formatVolumeDisplay(result: PondVolumeResult): string {
  if (result.volumeM3 == null && result.volumeLiter == null) return '—';
  const parts: string[] = [];
  if (result.volumeM3 != null) parts.push(`${result.volumeM3.toLocaleString('id-ID')} m³`);
  if (result.volumeLiter != null) parts.push(`${result.volumeLiter.toLocaleString('id-ID')} L`);
  return parts.join(' · ');
}
