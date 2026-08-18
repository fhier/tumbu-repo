'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application Runtime Error:', error);
  }, [error]);

  const handleFullReset = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tumbu-token');
        localStorage.removeItem('tumbu-user');
        localStorage.removeItem('tumbu-workspaces');
        localStorage.removeItem('tumbu-active-workspace');
        window.location.href = '/';
      }
    } catch {
      reset();
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 rounded-full bg-[#0EA5E9]/20 flex items-center justify-center text-[#0EA5E9] mb-4 border border-[#0EA5E9]/30">
        <AlertTriangle className="w-8 h-8 text-[#0EA5E9]" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">TUMBU OS — Penyesuaian Sesi</h2>
      <p className="text-slate-400 max-w-md text-sm mb-6 leading-relaxed">
        Terjadi pembaruan sistem atau data lokal memerlukan penyegaran. Klik tombol di bawah untuk memuat ulang halaman dengan aman.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => reset()}
          className="h-11 px-6 rounded-full bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 animate-spin" /> Muat Ulang Tampilan
        </button>
        <button
          onClick={handleFullReset}
          className="h-11 px-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
        >
          <Home className="w-4 h-4" /> Reset ke Beranda
        </button>
      </div>
    </div>
  );
}
