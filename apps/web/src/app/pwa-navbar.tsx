'use client';

import React from 'react';

interface PwaNavBarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isDistributor: boolean;
  colors: any;
}

export function PwaNavBar({ activeTab, setActiveTab, isDistributor, colors }: PwaNavBarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: colors.cardBg,
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${colors.border}`,
        display: 'grid',
        gridTemplateColumns: isDistributor ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)',
        alignItems: 'center',
        zIndex: 90,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}
    >
      {/* Item 1: Beranda */}
      <button
        type="button"
        onClick={() => { setActiveTab('home'); }}
        style={{ background: 'transparent', border: 'none', color: activeTab === 'home' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 20 }}>🏠</span>
        <span style={{ fontSize: 9 }}>Beranda</span>
      </button>

      {/* Item 2: Stok Benih */}
      {isDistributor && (
        <button
          type="button"
          onClick={() => { setActiveTab('lahan'); }}
          style={{ background: 'transparent', border: 'none', color: activeTab === 'lahan' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20 }}>📦</span>
          <span style={{ fontSize: 9 }}>Stok Benih</span>
        </button>
      )}

      {/* 🌟 BIG CENTRAL GREEN (+) BUTTON - PERFECTLY CENTERED FLEXBOX */}
      {isDistributor && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <button
            type="button"
            onClick={() => setActiveTab('jual')}
            title="Tambah Transaksi"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: colors.green,
              color: '#FFFFFF',
              border: 'none',
              fontSize: 32,
              fontWeight: 300,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: 4,
              boxShadow: `0 6px 20px ${colors.green}50`,
              transform: 'translateY(-14px)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            +
          </button>
        </div>
      )}

      {/* Item 4: Gudang -> Mitra & Logs */}
      <button
        type="button"
        onClick={() => { setActiveTab('gudang'); }}
        style={{ background: 'transparent', border: 'none', color: activeTab === 'gudang' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 20 }}>👥</span>
        <span style={{ fontSize: 9 }}>Mitra & Logs</span>
      </button>

      {/* Item 5: Pengaturan & Tema */}
      <button
        type="button"
        onClick={() => setActiveTab('settings')}
        style={{ background: 'transparent', border: 'none', color: activeTab === 'settings' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 20 }}>⚙️</span>
        <span style={{ fontSize: 9 }}>Tema</span>
      </button>
    </nav>
  );
}
