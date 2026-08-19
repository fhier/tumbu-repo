'use client';

import React from 'react';
import {
  Bot, Building2, Users, FileText, CreditCard,
  Layers, ShieldCheck, Settings, Boxes, Activity,
  LayoutDashboard, KeyRound
} from 'lucide-react';

interface PlatformAdminSkinProps {
  workspaceName: string;
  activeWorkspace: any;
  platformTab: string;
  onNotify: (msg: string) => void;
  children?: React.ReactNode;
}

const TAB_HEADER_META: Record<string, { title: string; subtitle: string; icon: any; category: string }> = {
  overview: { title: 'Platform Control Center', subtitle: 'Monitoring skala operasional & statistik ekosistem perikanan air tawar', icon: LayoutDashboard, category: 'CONTROL PLANE' },
  platform: { title: 'Platform Control Center', subtitle: 'Monitoring skala operasional & statistik ekosistem perikanan air tawar', icon: LayoutDashboard, category: 'CONTROL PLANE' },
  workspaces: { title: 'Manajemen Tenant & Usaha', subtitle: 'Daftar workspace pembudidaya, distributor, & unit perikanan', icon: Building2, category: 'CONTROL PLANE' },
  leads: { title: 'Daftar Minat & Pendaftaran Usaha', subtitle: 'Calon pengguna baru yang mengajukan ruang kerja', icon: Activity, category: 'CONTROL PLANE' },
  blueprints: { title: 'Katalog Blueprint Usaha Perikanan', subtitle: 'Template & alur kerja operasional terstandarisasi', icon: Layers, category: 'KONFIGURASI' },
  modules: { title: 'Katalog Modul Master System', subtitle: 'Daftar kapabilitas & modul terintegrasi platform', icon: Boxes, category: 'KONFIGURASI' },
  plans: { title: 'Paket Komersial & Langganan', subtitle: 'Konfigurasi batas kuota & harga paket usaha', icon: CreditCard, category: 'KEUANGAN PLATFORM' },
  billing: { title: 'Billing, Invoice, & Verifikasi Pembayaran', subtitle: 'Manajemen tagihan tenant & konfirmasi pembayaran', icon: FileText, category: 'KEUANGAN PLATFORM' },
  members: { title: 'Anggota & Hak Akses Platform Admin', subtitle: 'Kelola tim pengelola platform & perizinan role', icon: Users, category: 'AKSES & KEAMANAN' },
  audit: { title: 'Audit Trail & Log Aktivitas System', subtitle: 'Jejak rekam aktivitas admin & aksi sensitif sistem', icon: ShieldCheck, category: 'AKSES & KEAMANAN' },
  settings: { title: 'Pengaturan System Master', subtitle: 'Konfigurasi global platform & preferensi sistem', icon: Settings, category: 'SISTEM MASTER' },
  ai_tumbu: { title: 'TUMBU AI Sentinel Master', subtitle: 'Asisten monitoring otomatis & analisis kesehatan platform', icon: Bot, category: 'ASISTEN AI' },
};

export function PlatformAdminSkin({
  workspaceName,
  activeWorkspace,
  platformTab,
  onNotify,
  children,
}: PlatformAdminSkinProps) {
  const meta = TAB_HEADER_META[platformTab] || {
    title: 'Platform Control Center',
    subtitle: 'Manajemen platform admin master',
    icon: Building2,
    category: 'CONTROL PLANE',
  };
  const IconComponent = meta.icon;

  return (
    <div className="space-y-6">
      {/* Header Banner Platform Admin */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/50 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 mt-0.5">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {meta.category}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Platform Founder Master</span>
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                {meta.title}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Renders child page (PlatformPages router) */}
      <div className="min-h-[480px]">
        {children || <div className="p-8 text-center text-[var(--text-muted)]">Konten platform memuat…</div>}
      </div>
    </div>
  );
}
