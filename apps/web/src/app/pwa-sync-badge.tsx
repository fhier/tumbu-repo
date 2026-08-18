'use client';

import { useEffect, useState } from 'react';
import { initPwaSyncListener, triggerOutboxSync } from './pwa-sync-engine';

export function PwaSyncBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    initPwaSyncListener((online, count) => {
      setIsOnline(online);
      setPendingCount(count);
    });
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const res = await triggerOutboxSync();
      setPendingCount(res.remainingCount);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: !isOnline
          ? 'rgba(239, 68, 68, 0.15)'
          : pendingCount > 0
          ? 'rgba(245, 158, 11, 0.15)'
          : 'rgba(16, 185, 129, 0.15)',
        color: !isOnline
          ? '#EF4444'
          : pendingCount > 0
          ? '#F59E0B'
          : '#10B981',
        border: `1px solid ${
          !isOnline
            ? 'rgba(239, 68, 68, 0.3)'
            : pendingCount > 0
            ? 'rgba(245, 158, 11, 0.3)'
            : 'rgba(16, 185, 129, 0.3)'
        }`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: !isOnline ? '#EF4444' : pendingCount > 0 ? '#F59E0B' : '#10B981',
          boxShadow: syncing ? '0 0 6px #10B981' : 'none',
        }}
      />

      <span>
        {!isOnline
          ? 'Offline (Disimpan di HP)'
          : syncing
          ? 'Menyinkronkan...'
          : pendingCount > 0
          ? `${pendingCount} Antrean Belum Sync`
          : 'Online · Synced'}
      </span>

      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 10,
            textDecoration: 'underline',
            padding: 0,
            marginLeft: 4,
          }}
        >
          Sync Sekarang
        </button>
      )}
    </div>
  );
}
