'use client';

import { computePondVolume, formatVolumeDisplay, type PondShape } from './aqua-pond-volume';

export function PondVolumeFields({
  shape,
  onShapeChange,
  lengthM,
  widthM,
  diameterM,
  depthM,
  onLengthChange,
  onWidthChange,
  onDiameterChange,
  onDepthChange,
  disabled,
}: {
  shape: PondShape;
  onShapeChange: (s: PondShape) => void;
  lengthM: number | '';
  widthM: number | '';
  diameterM: number | '';
  depthM: number | '';
  onLengthChange: (v: number | '') => void;
  onWidthChange: (v: number | '') => void;
  onDiameterChange: (v: number | '') => void;
  onDepthChange: (v: number | '') => void;
  disabled?: boolean;
}) {
  const vol = computePondVolume({ shape, lengthM, widthM, diameterM, depthM });

  return (
    <>
      <div className="field full">
        <span>Bentuk kolam</span>
        <div className="trouble-chip-grid">
          <button
            type="button"
            className={`species-chip${shape === 'box' ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => onShapeChange('box')}
          >
            Kotak / Persegi
          </button>
          <button
            type="button"
            className={`species-chip${shape === 'round' ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => onShapeChange('round')}
          >
            Bundar / Bioflok
          </button>
        </div>
      </div>

      {shape === 'box' ? (
        <>
          <label className="field">
            <span>Panjang (m)</span>
            <input
              type="number"
              min={0}
              step="any"
              value={lengthM}
              onChange={(e) => onLengthChange(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={disabled}
              placeholder="P"
            />
          </label>
          <label className="field">
            <span>Lebar (m)</span>
            <input
              type="number"
              min={0}
              step="any"
              value={widthM}
              onChange={(e) => onWidthChange(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={disabled}
              placeholder="L"
            />
          </label>
        </>
      ) : (
        <label className="field">
          <span>Diameter (m)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={diameterM}
            onChange={(e) => onDiameterChange(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
            placeholder="D"
          />
        </label>
      )}

      <label className="field">
        <span>Tinggi air (m)</span>
        <input
          type="number"
          min={0}
          step="any"
          value={depthM}
          onChange={(e) => onDepthChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
          placeholder="T"
        />
      </label>

      <div className="field full pond-volume-live">
        <div className="aqua-cycle-estimate-card">
          <strong>Volume air (otomatis)</strong>
          <span>{formatVolumeDisplay(vol)}</span>
          {vol.areaM2 != null ? (
            <small>Luas permukaan: {vol.areaM2.toLocaleString('id-ID')} m²</small>
          ) : null}
          <small className="hint">
            {shape === 'box'
              ? 'Rumus: P × L × T'
              : 'Rumus: 0,25 × π × D² × T'}
          </small>
        </div>
      </div>
    </>
  );
}
