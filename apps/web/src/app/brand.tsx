'use client';

import Image from 'next/image';

export function BrandLogo({
  variant = 'light',
  size = 'md',
  showWordmark = true,
  compact = false,
}: {
  /** light = navy mark on light bg; dark = white mark on navy bg; shell = horizontal lockup for sidebar */
  variant?: 'light' | 'dark' | 'compact' | 'full' | 'shell';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  /** @deprecated prefer variant="compact" */
  compact?: boolean;
}) {
  const isCompact = compact || variant === 'compact';
  const onDark = variant === 'dark' || variant === 'shell';
  const word = showWordmark && variant !== 'shell';
  const px = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const shellH = size === 'sm' ? 32 : size === 'lg' ? 48 : 40;
  const shellW = Math.round(shellH * (280 / 64));

  if (variant === 'shell') {
    return (
      <div className="brand-logo is-shell" style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
        <Image src="/tumbu-logo-shell.svg" alt="TUMBU" width={shellW} height={shellH} priority />
      </div>
    );
  }

  return (
    <div className={`brand-logo ${onDark ? 'is-dark' : 'is-light'}${isCompact ? ' is-compact' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="brand-mark" style={{ display: 'inline-flex', lineHeight: 0, borderRadius: 10 }}>
        <Image
          src={onDark ? '/tumbu-logo-light.svg' : '/tumbu-logo-dark.svg'}
          alt="TUMBU"
          width={px}
          height={px}
          priority
        />
      </span>
      {word && !isCompact && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
          <b style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size === 'sm' ? 14 : size === 'lg' ? 20 : 16, color: onDark ? '#fff' : 'var(--navy)', letterSpacing: '.04em', lineHeight: 1.05, margin: 0 }}>
            TUM<span style={{ color: onDark ? '#86EFAC' : 'var(--green)' }}>BU</span>
          </b>
          <small style={{ display: 'block', fontSize: 9.5, fontWeight: 600, letterSpacing: '.02em', color: onDark ? '#AFC3E0' : 'var(--muted)', textTransform: 'none', lineHeight: 1.1, marginTop: 1 }}>
            Business OS
          </small>
        </span>
      )}
      {word && isCompact && (
        <b style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14, color: onDark ? '#fff' : 'var(--navy)' }}>
          TUM<span style={{ color: onDark ? '#86EFAC' : 'var(--green)' }}>BU</span>
        </b>
      )}
    </div>
  );
}
