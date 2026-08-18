'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker for PWA compliance
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('TUMBU ServiceWorker Registered'))
        .catch((err) => console.log('SW Reg error:', err));
    }

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const [showInstructions, setShowInstructions] = useState(false);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || dismissed) return null;

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(135deg, #0A1F3D 0%, #0F1E3A 100%)',
          borderBottom: '1px solid rgba(0, 208, 132, 0.3)',
          color: '#FFFFFF',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          position: 'relative',
          zIndex: 99,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#00D084',
              color: '#0A1F3D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            T
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#00D084' }}>
              Install TUMBU Business OS PWA
            </div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              Bisa diakses cepat dari layar HP & catat data tanpa internet.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              background: '#00D084',
              color: '#0A1F3D',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 208, 132, 0.4)',
            }}
          >
            📱 Install Aplikasi
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              opacity: 0.6,
              fontSize: 16,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            aria-label="Tutup Banner"
          >
            ✕
          </button>
        </div>
      </div>

      {/* INSTALATION GUIDANCE MODAL */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded-[20px] p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-[16px] text-[#00D084]">📱 Cara Install PWA di Smartphone</h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] font-bold text-[18px]"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3.5 text-[13px] leading-relaxed">
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <div className="font-bold text-[14px] text-[#0EA5E9] mb-1">Android (Chrome / Edge / Brave):</div>
                <p className="text-[var(--text-muted)]">Ketik ikon <strong>titik tiga (⋮)</strong> di sudut kanan atas browser &gt; pilih <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Install Aplikasi"</strong>.</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <div className="font-bold text-[14px] text-[#22C55E] mb-1">iOS (Safari iPhone / iPad):</div>
                <p className="text-[var(--text-muted)]">Ketik ikon <strong>Bagikan (Share / ⎋)</strong> di bawah browser &gt; gulir ke bawah dan pilih <strong>"Add to Home Screen" (Tambah ke Layar Utama)</strong>.</p>
              </div>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="mt-5 w-full py-2.5 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] font-semibold text-[13px]"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
