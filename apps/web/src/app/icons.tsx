'use client';

import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" className="acc" /></>,
  pembelian: <><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20 8H7" /><path d="M16 4v4M14 6h4" className="acc" /></>,
  penjualan: <><path d="M4 12h14" /><path d="M14 7l5 5-5 5" className="acc" /><path d="M4 7v10" /></>,
  stok: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" className="acc" /></>,
  kas: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" className="acc" /></>,
  bank: <><path d="M4 10h16" /><path d="M12 4l9 6H3l9-6z" /><path d="M6 10v7M10 10v7M14 10v7M18 10v7" /><path d="M4 17h16" className="acc" /></>,
  hutang: <><path d="M7 3h8l4 4v14H7V3z" /><path d="M15 3v4h4" /><path d="M9 13l2 2 4-4" className="acc" /></>,
  piutang: <><path d="M7 3h8l4 4v14H7V3z" /><path d="M15 3v4h4" /><path d="M10 13h4M12 11v6" className="acc" /></>,
  laporan: <><path d="M5 19V10M10 19V6M15 19v-8M20 19V8" className="acc" /></>,
  beritaacara: <><path d="M7 3h8l4 4v14H7V3z" /><path d="M15 3v4h4" /><path d="M10 14l6-6" className="acc" /></>,
  suratjalan: <><path d="M3 15h11V8H3v7z" /><path d="M14 11h3l3 3v3h-6v-6z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  invoice: <><path d="M7 3h8l4 4v14H7V3z" /><path d="M15 3v4h4" /><path d="M10 12h4M10 15h5" /></>,
  pengaturan: <><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  pengguna: <><circle cx="12" cy="8" r="3.5" /><path d="M5 19a7 7 0 0 1 14 0" /></>,
  sinkron: <><path d="M4 12a8 8 0 0 1 13-5.5M20 12a8 8 0 0 1-13 5.5" /><path d="M17 3v4h-4M7 21v-4h4" className="acc" /></>,
  keamanan: <><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" className="acc" /></>,
  ai: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" className="acc" /><path d="M5.5 5.5l2 2M16.5 16.5l2 2M16.5 7.5l2-2M5.5 18.5l2-2" /></>,
  platform: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" className="acc" /></>,
  workspace: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18" className="acc" /></>,
  blueprint: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" className="acc" /></>,
  modul: <><path d="M4 7h6v6H4zM14 7h6v6h-6zM9 14h6v6H9z" /></>,
  pengeluaran: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" className="acc" /><path d="M5 19h14" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" className="acc" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" className="acc" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" className="acc" /></>,
  print: <><path d="M6 9V3h12v6" /><path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="13" width="12" height="8" rx="1" className="acc" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" className="acc" /></>,
  pay: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9.5a1.5 1.5 0 0 0 0 3H15" className="acc" /></>,
};

export function Ti({ name, size = 18 }: { name: string; size?: number }) {
  const paths = ICONS[name] || ICONS.dashboard;
  return (
    <svg className="ti" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</g>
    </svg>
  );
}

export const PAGE_ICONS: Record<string, string> = {
  platform: 'platform', workspaces: 'workspace', blueprints: 'blueprint', modules: 'modul',
  pengaturan: 'pengaturan', dashboard: 'dashboard', beritaacara: 'beritaacara', pembelian: 'pembelian',
  penjualan: 'penjualan', suratjalan: 'suratjalan', pengeluaran: 'pengeluaran', stok: 'stok',
  kas: 'kas', bank: 'bank', hutang: 'hutang', piutang: 'piutang', kwitansi: 'invoice',
  keuangan: 'laporan', laporan: 'laporan', master: 'pengguna', backup: 'sinkron', tutupbuku: 'keamanan',
  members: 'keamanan', customers: 'pengguna', services: 'modul', orders: 'invoice',
  billing: 'invoice',
  schedule: 'dashboard', technicians: 'pengguna', assets: 'stok', invoice: 'invoice', quotations: 'invoice',
  leads: 'pengguna', audit: 'keamanan', asisten: 'ai',
  analisa: 'laporan', onboarding: 'modul', plans: 'blueprint',
  kolam: 'stok', komoditas: 'pengguna', pakan: 'pengeluaran', siklus: 'orders',
  'p3k-ikan': 'keamanan',
};
