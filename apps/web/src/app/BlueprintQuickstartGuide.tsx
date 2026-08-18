'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, HelpCircle, Building2, Package, ShoppingCart, Printer, Sparkles, X } from 'lucide-react';

interface QuickstartProps {
  blueprintType: 'distributor' | 'budidaya' | string;
  workspaceName: string;
  onNavigateTab: (tabName: string) => void;
  onOpenAddProduct?: () => void;
  onOpenAddTx?: () => void;
  onNotify?: (msg: string) => void;
}

export function BlueprintQuickstartGuide({
  blueprintType,
  workspaceName,
  onNavigateTab,
  onOpenAddProduct,
  onOpenAddTx,
  onNotify,
}: QuickstartProps) {
  const [dismissed, setDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  if (dismissed) return null;

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isDistributor = blueprintType === 'operational_distributor' || blueprintType === 'distributor';

  const steps = isDistributor
    ? [
        {
          id: 'step_identity',
          icon: <Building2 className="w-4 h-4 text-sky-500" />,
          title: '1. Atur Profil & Rekening Usaha',
          desc: 'Lengkapi nama toko, alamat, HP, dan nomor rekening penerima pembayaran di menu Pengaturan.',
          actionLabel: 'Ke Pengaturan Usaha',
          onClick: () => onNavigateTab('pengaturan'),
        },
        {
          id: 'step_master',
          icon: <Package className="w-4 h-4 text-emerald-500" />,
          title: '2. Tambahkan Master Stok Benih & Pakan',
          desc: 'Input daftar benih/ikan atau pakan pertama Anda untuk melacak saldo stok grosir.',
          actionLabel: '+ Tambah Produk / SKU',
          onClick: () => {
            onNavigateTab('stok');
            if (onOpenAddProduct) onOpenAddProduct();
          },
        },
        {
          id: 'step_tx',
          icon: <ShoppingCart className="w-4 h-4 text-indigo-500" />,
          title: '3. Buat Surat Jalan & Penjualan Pertama',
          desc: 'Catat transaksi penjualan benih, buat Surat Jalan pengiriman, atau simpan Purchase Order (PO).',
          actionLabel: '+ Buat Penjualan / PO',
          onClick: () => {
            onNavigateTab('penjualan');
            if (onOpenAddTx) onOpenAddTx();
          },
        },
        {
          id: 'step_print',
          icon: <Printer className="w-4 h-4 text-purple-500" />,
          title: '4. Cetak Struk Thermal (58mm/80mm) & PDF',
          desc: 'Gunakan modul cetak printer thermal bluetooth untuk kuitansi di kolam atau unduh PDF resmi.',
          actionLabel: 'Lihat Daftar Cetak',
          onClick: () => onNavigateTab('penjualan'),
        },
        {
          id: 'step_ai',
          icon: <Sparkles className="w-4 h-4 text-amber-500" />,
          title: '5. Manfaatkan Asisten AI TUMBU OS',
          desc: 'Perintahkan AI lewat pesan teks/suara untuk merekap otomatis penjualan dan analisis laba rugi.',
          actionLabel: 'Buka Sentinel AI',
          onClick: () => onNavigateTab('ai_tumbu'),
        },
      ]
    : [
        {
          id: 'step_identity',
          icon: <Building2 className="w-4 h-4 text-sky-500" />,
          title: '1. Atur Profil Tambak & Lokasi',
          desc: 'Isi nama lokasi tambak, kontak penanggung jawab, dan nomor rekening di menu Pengaturan.',
          actionLabel: 'Ke Pengaturan Tambak',
          onClick: () => onNavigateTab('pengaturan'),
        },
        {
          id: 'step_pond',
          icon: <Package className="w-4 h-4 text-emerald-500" />,
          title: '2. Daftarkan Kolam / Petak Pertama',
          desc: 'Input kode kolam, tebar benih awal, volume air, dan profil spesies komoditas (Lele, Gurame, Patin, Udang).',
          actionLabel: '+ Tambah Master Kolam',
          onClick: () => onNavigateTab('siklus'),
        },
        {
          id: 'step_recording',
          icon: <ShoppingCart className="w-4 h-4 text-indigo-500" />,
          title: '3. Catat Pakan, Sampling & Kematian Harian',
          desc: 'Lakukan recording harian feed log, sampling bobot/SR, dan perolehan FCR real-time.',
          actionLabel: 'Mulai Form Recording',
          onClick: () => onNavigateTab('recording'),
        },
        {
          id: 'step_closing',
          icon: <Printer className="w-4 h-4 text-purple-500" />,
          title: '4. Panen & Cetak Laporan Tutup Buku (PDF)',
          desc: 'Lakukan panen parsial/total, hitung HPP per kg, lalu cetak laporan closing periode PDF.',
          actionLabel: 'Buka Closing Periode',
          onClick: () => onNavigateTab('closing'),
        },
        {
          id: 'step_ai',
          icon: <Sparkles className="w-4 h-4 text-amber-500" />,
          title: '5. Konsultasi Diagnostik Air & Penyakit via AI',
          desc: 'Gunakan AI Sentinel untuk diagnosa penyakit ikan, saran pakan, dan analisis efisiensi FCR.',
          actionLabel: 'Tanya AI Sentinel',
          onClick: () => onNavigateTab('ai_tumbu'),
        },
      ];

  const totalSteps = steps.length;
  const doneCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPct = Math.round((doneCount / totalSteps) * 100);

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl p-5 shadow-xl border border-sky-500/30 mb-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-400 border border-sky-500/30 uppercase tracking-wider">
              Blueprint {isDistributor ? 'Distributor Benih' : 'Budidaya Perikanan'}
            </span>
            <span className="text-xs text-slate-400">Panduan Langkah Awal Member</span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-white mt-1 flex items-center gap-2">
            <span>🚀 Selamat Datang di {workspaceName || 'TUMBU OS'}</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold text-sky-400">{doneCount} / {totalSteps} Langkah Selesai ({progressPct}%)</div>
            <div className="w-28 sm:w-36 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Sembunyikan panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => {
          const isDone = Boolean(completedSteps[step.id]);
          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-300'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-700">
                      {step.icon}
                    </div>
                    <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                      {step.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="cursor-pointer transition hover:scale-110"
                    title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-3">
                  {step.desc}
                </p>
              </div>

              <button
                type="button"
                onClick={step.onClick}
                className="w-full h-8 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950 font-bold text-[11px] border border-sky-500/30 transition cursor-pointer flex items-center justify-center gap-1 mt-1"
              >
                <span>{step.actionLabel}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
