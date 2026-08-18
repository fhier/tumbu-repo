'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#0A1F3D] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#2BBF78] mb-4 shadow-xl">
        <Compass className="w-8 h-8 text-[#2BBF78]" />
      </div>
      <h1 className="text-3xl font-extrabold text-white mb-2">404 — Halaman Tidak Ditemukan</h1>
      <p className="text-slate-300 max-w-md text-sm mb-6 leading-relaxed">
        Halaman yang Anda tuju tidak ditemukan atau URL telah diperbarui. Silakan kembali ke beranda aplikasi TUMBU OS.
      </p>
      <Link
        href="/"
        className="h-11 px-6 rounded-full bg-[#2BBF78] hover:bg-[#22a465] text-slate-950 font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 no-underline"
      >
        <Home className="w-4 h-4 text-slate-950" /> Kembali ke Beranda
      </Link>
    </div>
  );
}
