'use client';

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen w-full bg-[#0A1F3D] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">TUMBU OS — Sistem Perlu Dimuat Ulang</h2>
        <p className="text-slate-300 max-w-md text-sm mb-6 leading-relaxed">
          Terjadi kendala saat memuat aset tampilan. Klik tombol di bawah untuk menyegarkan tampilan aplikasi.
        </p>
        <button
          onClick={() => reset()}
          className="h-11 px-6 rounded-full bg-[#2BBF78] hover:bg-[#22a465] text-slate-950 font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border-0"
        >
          <RefreshCw className="w-4 h-4 text-slate-950" /> Muat Ulang Tampilan
        </button>
      </body>
    </html>
  );
}
