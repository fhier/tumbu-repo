'use client';

import type { ReactNode } from 'react';
import { Ti } from './icons';

/** CSS isometric fisheries scene — reusable on landing, auth & platform. */
export function FisheriesScene({
  variant = 'hero',
  className = '',
}: {
  variant?: 'hero' | 'compact' | 'card' | 'auth';
  className?: string;
}) {
  const iconSize = variant === 'hero' ? 18 : 14;
  return (
    <div className={`fish-scene fish-scene--${variant}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <div className="fish-scene-sky" />
      <div className="fish-scene-hills" />
      <div className="fish-scene-water" />
      <div className="fish-scene-land" />
      <div className="fish-scene-road" />
      <div className="fish-scene-pond fish-scene-pond--1" />
      <div className="fish-scene-pond fish-scene-pond--2" />
      <div className="fish-scene-pond fish-scene-pond--3" />
      <div className="fish-scene-pond fish-scene-pond--4" />
      <div className="fish-scene-bldg fish-scene-bldg--main" />
      <div className="fish-scene-bldg fish-scene-bldg--side" />
      <div className="fish-scene-truck">
        <span className="fish-scene-truck-cab" />
        <span className="fish-scene-truck-bed" />
      </div>
      <div className="fish-scene-markers">
        <span className="fish-marker"><Ti name="stok" size={iconSize} /></span>
        <span className="fish-marker"><Ti name="pembelian" size={iconSize} /></span>
        <span className="fish-marker"><Ti name="penjualan" size={iconSize} /></span>
      </div>
    </div>
  );
}

/** Mini scene strip for persona / picker cards. */
export function AudienceCardScene({ kind }: { kind: string }) {
  return (
    <div className={`fish-card-scene fish-card-scene--${kind}`} aria-hidden="true">
      <div className="fish-card-scene-bg" />
      {kind === 'distributor' && (
        <>
          <div className="fish-card-scene-pond" />
          <div className="fish-card-scene-box" />
        </>
      )}
      {kind === 'hatcheri' && (
        <>
          <div className="fish-card-scene-pond fish-card-scene-pond--sm" />
          <div className="fish-card-scene-pond fish-card-scene-pond--sm delay" />
          <div className="fish-card-scene-pond fish-card-scene-pond--sm delay2" />
          <div className="fish-card-scene-pond fish-card-scene-pond--sm delay3" />
        </>
      )}
      {kind === 'pembudidaya' && (
        <>
          <div className="fish-card-scene-pond fish-card-scene-pond--lg" />
          <div className="fish-card-scene-pond fish-card-scene-pond--md" />
        </>
      )}
      {kind === 'pengepul' && (
        <>
          <div className="fish-card-scene-bldg" />
          <div className="fish-card-scene-crate" />
        </>
      )}
    </div>
  );
}

const LANDING_DASH_NAV = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'penjualan', label: 'Penjualan' },
  { key: 'pembelian', label: 'Pembelian' },
  { key: 'stok', label: 'Stok' },
  { key: 'laporan', label: 'Laporan' },
] as const;

/** Dashboard mock sidebar — mirrors platform nav (icon + label). */
export function LandingDashNav({ active = 'dashboard' }: { active?: string }) {
  return (
    <>
      <div className="tl-dash-logo">T</div>
      {LANDING_DASH_NAV.map((item) => (
        <span key={item.key} className={item.key === active ? 'on' : ''} title={item.label}>
          <Ti name={item.key} size={14} />
          <em>{item.label}</em>
        </span>
      ))}
    </>
  );
}

/** Left panel for login / register / member flows. */
export function AuthBrandPanel({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle: string;
  bullets?: string[];
}) {
  return (
    <aside className="login-brand">
      <div className="login-brand-hero-img" style={{ backgroundImage: "url('/design/hero-fishery-isometric.webp')" }} aria-hidden="true" />
      <svg className="login-brand-flow" viewBox="0 0 420 80" aria-hidden="true">
        <path d="M0 48 C80 8 140 72 220 32 S340 68 420 24" />
      </svg>
      <div className="login-brand-content">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </aside>
  );
}

/** Icon map for business-type picker cards. */
export const BIZ_TYPE_ICONS: Record<string, string> = {
  operational_distributor: 'stok',
  distributor: 'stok',
  aquaculture_freshwater: 'kolam',
  pembudidaya: 'kolam',
  hatcheri: 'blueprint',
  pengepul: 'penjualan',
};

export function bizTypeIcon(id: string, kind?: string): string {
  if (BIZ_TYPE_ICONS[id]) return BIZ_TYPE_ICONS[id];
  if (kind === 'aquaculture') return 'kolam';
  if (kind === 'distributor') return 'stok';
  return 'platform';
}
