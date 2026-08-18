'use client';

import React, { useState, useEffect } from 'react';
import { BrandLogo } from './brand';
import { PwaSyncBadge } from './pwa-sync-badge';
import { PrintDialog, PrintDialogData } from './print-dialog';
import { enqueueOutboxItem, getOfflineMasterData } from './pwa-sync-engine';

interface PwaMobileShellProps {
  apiFetch?: <T>(p: string, i?: RequestInit) => Promise<T>;
  onRefresh?: () => void;
  userName: string;
  userRole: string;
  wsContext: {
    workspace: { name: string; code: string; logoUrl?: string | null };
    blueprint: { name: string; kind?: string };
  } | null;
  products: Array<{ id: string; name: string; sizeLabel?: string; stock: number; unit: string; price: number }>;
  suratJalan: Array<{ id: string; number: string; date: string; customer: string; status: string }>;
  beritaAcara: Array<{ id: string; number: string; date: string; supplier: string; status: string }>;
  finance: { sales: number; purchases: number; cashBalance: number; netProfit?: number } | null;
  onLogout: () => void;
}

const DEFAULT_SPECIES = [
  'Nila Merah',
  'Nila Hitam',
  'Lele',
  'Gurame',
  'Patin',
  'Mas',
  'Bawal',
  'Nilem',
  'Pelahlar',
  'Lainnya'
];

const DEFAULT_SIZES = [
  '2-3 cm', '3-4 cm', '4-5 cm', '5-6 cm', '6-7 cm', '7-8 cm', '8-9 cm', '9-10 cm', '11-12 cm',
  'P', 'BL',
  '3', '4', '5', '6', '7', '8', '9',
  '3,5', '4,6', '4,7', '5,7', '6,8', '7,9',
  '10', '11', '12'
];

const money = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const defaultApiFetch = async <T,>(p: string, i?: RequestInit) => ({} as T);

export function PwaMobileShell({
  apiFetch = defaultApiFetch,
  onRefresh = () => {},
  userName,
  userRole,
  wsContext,
  products,
  suratJalan,
  beritaAcara,
  finance,
  onLogout,
}: PwaMobileShellProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'lahan' | 'gudang' | 'profil' | 'sync' | 'jual' | 'beli' | 'biaya' | 'settings' | 'pakan' | 'kematian' | 'sampling' | 'panen'>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedPond, setSelectedPond] = useState<string>('Semua Kolam');
  const [printDialogData, setPrintDialogData] = useState<PrintDialogData | null>(null);

  // UX Contract Features
  const [isActionHubOpen, setIsActionHubOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Offline Master Data (Cycles, Feeds, Ponds, Products, Partners)
  const [offlineMaster, setOfflineMaster] = useState<{ cycles?: any[]; ponds?: any[]; products?: any[]; partners?: any[] } | null>(null);
  useEffect(() => {
    void getOfflineMasterData().then((data) => {
      if (data) setOfflineMaster(data);
    });
  }, []);

  // Segmented control inside Gudang (Mitra & Logs) tab
  const [gudangSegment, setGudangSegment] = useState<'mitra' | 'riwayat'>('mitra');
  const [mitraType, setMitraType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [newMitraName, setNewMitraName] = useState('');
  const [newMitraPhone, setNewMitraPhone] = useState('');

  // Suppliers & Customers State
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);

  // Dynamic Transaction Data Lists
  const [salesList, setSalesList] = useState<any[]>([]);
  const [purchasesList, setPurchasesList] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);

  // Dashboard Dynamic Metrics
  const [metrics, setMetrics] = useState({
    salesToday: 0,
    seedStock: 0,
    cashBalance: 0,
    receivables: 0,
    payables: 0,
  });

  // Form Inputs State (Penjualan / SJ)
  const [sjCustomer, setSjCustomer] = useState('');
  const [sjPhone, setSjPhone] = useState('');
  const [sjAlamat, setSjAlamat] = useState('');
  const [sjDriver, setSjDriver] = useState('');
  const [sjVehicle, setSjVehicle] = useState('');
  const [sjPaymentMethod, setSjPaymentMethod] = useState<'TUNAI' | 'PIUTANG'>('TUNAI');
  const [sjKasAccount, setSjKasAccount] = useState<'KAS' | 'BANK'>('KAS');
  const [sjNotes, setSjNotes] = useState('');

  // Multi-item Sales State
  const [sjItems, setSjItems] = useState([
    { id: '1', productId: '', category: 'BENIH', fishName: '', sizeLabel: '', qty: 0, price: 0, weight: 0, sampling: 0 }
  ]);

  const handleItemValueChange = (id: string, field: string, val: any) => {
    setSjItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextItem = { ...item, [field]: val };
        // If Category is BENIH and weight/sampling are populated, calculate Qty
        if (nextItem.category === 'BENIH' && (field === 'weight' || field === 'sampling')) {
          const w = Number(nextItem.weight) || 0;
          const s = Number(nextItem.sampling) || 0;
          if (w > 0 && s > 0) {
            nextItem.qty = Math.round(w * s);
          }
        }
        return nextItem;
      }
      return item;
    }));
  };

  const addSjItem = () => {
    setSjItems([
      ...sjItems,
      { id: String(Date.now()), productId: '', category: 'BENIH', fishName: '', sizeLabel: '', qty: 0, price: 0, weight: 0, sampling: 0 }
    ]);
  };

  const removeSjItem = (id: string) => {
    if (sjItems.length > 1) {
      setSjItems(sjItems.filter(it => it.id !== id));
    }
  };

  const totalSjAmount = sjItems.reduce((acc, it) => acc + (it.qty * it.price), 0);
  const totalSjQty = sjItems.reduce((acc, it) => acc + Number(it.qty || 0), 0);

  // Form Inputs State (Pembelian / BA)
  const [baSupplier, setBaSupplier] = useState('');
  const [baProductId, setBaProductId] = useState('');
  const [baCategory, setBaCategory] = useState<'BENIH' | 'IKAN_KONSUMSI'>('BENIH');
  const [baSpecies, setBaSpecies] = useState('');
  const [baSize, setBaSize] = useState('');
  const [baWeight, setBaWeight] = useState(0);
  const [baSampling, setBaSampling] = useState(0);
  const [baQty, setBaQty] = useState<any>('');
  const [baPrice, setBaPrice] = useState<any>('');
  const [baTransport, setBaTransport] = useState<any>('');
  const [baPaymentMethod, setBaPaymentMethod] = useState<'TUNAI' | 'HUTANG'>('TUNAI');
  const [baKasAccount, setBaKasAccount] = useState<'KAS' | 'BANK'>('KAS');
  const [baNotes, setBaNotes] = useState('');

  // Auto calculate BA Qty
  useEffect(() => {
    if (baCategory === 'BENIH' && baWeight > 0 && baSampling > 0) {
      setBaQty(Math.round(baWeight * baSampling));
    }
  }, [baCategory, baWeight, baSampling]);

  // Form Inputs State (Pengeluaran / Biaya)
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState<any>('');
  const [expNote, setExpNote] = useState('');

  // Form Inputs State (Budidaya)
  const [bdiCycleId, setBdiCycleId] = useState('');
  const [bdiFeedId, setBdiFeedId] = useState('');
  const [bdiQtyKg, setBdiQtyKg] = useState<any>('');
  const [bdiDeadPcs, setBdiDeadPcs] = useState<any>('');
  const [bdiMortalityCause, setBdiMortalityCause] = useState('');
  const [bdiAvgWeight, setBdiAvgWeight] = useState<any>('');
  const [bdiSamplePcs, setBdiSamplePcs] = useState<any>('');
  const [bdiHarvestKg, setBdiHarvestKg] = useState<any>('');
  const [bdiHarvestPcs, setBdiHarvestPcs] = useState<any>('');

  const handleSaveBudidaya = (type: 'FeedEvent' | 'MortalityEvent' | 'SamplingEvent' | 'HarvestEvent') => {
    if (!bdiCycleId) { alert('Pilih siklus terlebih dahulu!'); return; }
    const eventId = `${type}_${Date.now()}`;
    const basePayload = { cycleId: bdiCycleId, eventAt: new Date().toISOString() };
    
    if (type === 'FeedEvent') {
      if (!bdiFeedId || !bdiQtyKg) { showToast('Pakan dan jumlah wajib diisi!', 'error'); return; }
      void enqueueOutboxItem(type, eventId, 'CREATE', { ...basePayload, feedTypeId: bdiFeedId, quantityKg: bdiQtyKg });
    } else if (type === 'MortalityEvent') {
      if (!bdiDeadPcs) { showToast('Jumlah kematian wajib diisi!', 'error'); return; }
      void enqueueOutboxItem(type, eventId, 'CREATE', { ...basePayload, deadCountPcs: bdiDeadPcs, cause: bdiMortalityCause });
    } else if (type === 'SamplingEvent') {
      if (!bdiAvgWeight) { showToast('Berat rata-rata wajib diisi!', 'error'); return; }
      void enqueueOutboxItem(type, eventId, 'CREATE', { ...basePayload, averageWeightGram: bdiAvgWeight, sampleCountPcs: bdiSamplePcs || undefined });
    } else if (type === 'HarvestEvent') {
      if (!bdiHarvestKg) { showToast('Jumlah panen (kg) wajib diisi!', 'error'); return; }
      void enqueueOutboxItem(type, eventId, 'CREATE', { ...basePayload, quantityKg: bdiHarvestKg, quantityPcs: bdiHarvestPcs || undefined });
    }
    
    showToast(`Data ${type.replace('Event', '')} berhasil disimpan offline!`);
    setActiveTab('home');
    setBdiQtyKg(''); setBdiDeadPcs(''); setBdiMortalityCause(''); setBdiAvgWeight(''); setBdiSamplePcs(''); setBdiHarvestKg(''); setBdiHarvestPcs('');
  };

  const isDark = theme === 'dark';
  const isDistributor = wsContext?.blueprint?.kind === 'operational_distributor' || wsContext?.blueprint?.kind === 'distributor';
  const isBudidaya = wsContext?.blueprint?.kind === 'aquaculture_freshwater' || wsContext?.blueprint?.kind === 'aquaculture';

  // Premium Landing Page colors (Updated to new TUMBU Logo Colors)
  const colors = {
    bg: isDark ? '#0F172A' : '#F9FBF7',
    bgGradient: isDark ? 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)' : '#F9FBF7',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textDark: isDark ? '#FFFFFF' : '#0F172A',
    textMuted: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)',
    navy: '#0F172A',
    green: '#0f766e', // Teal from logo
    amber: '#F59E0B', // Gold from logo dot
    inputBg: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
  };

  const handleSaveSj = () => {
    const newSjNumber = `SJ/2026/08/${String(salesList.length + 1).padStart(3, '0')}`;
    const newSoId = `SO_${Date.now()}`;
    const desc = sjItems.map(it => `${it.qty.toLocaleString('id-ID')} ${it.category === 'BENIH' ? 'ekor' : 'kg'} · ${it.fishName} (${it.sizeLabel})`).join(', ');

    const newSj = {
      id: String(Date.now()),
      number: newSjNumber,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      customer: sjCustomer,
      detail: desc,
      total: totalSjAmount,
      status: sjPaymentMethod,
      time: 'Baru saja',
    };

    setSalesList([newSj, ...salesList]);

    // Update dynamic metrics
    setMetrics(prev => ({
      ...prev,
      salesToday: prev.salesToday + totalSjAmount,
      seedStock: prev.seedStock - (sjItems.some(it => it.category === 'BENIH') ? totalSjQty : 0),
      cashBalance: sjPaymentMethod === 'TUNAI' ? prev.cashBalance + totalSjAmount : prev.cashBalance,
      receivables: sjPaymentMethod === 'PIUTANG' ? prev.receivables + totalSjAmount : prev.receivables,
    }));

    // Offline outbox save via sync engine
    void enqueueOutboxItem('SalesOrder', newSoId, 'CREATE', {
      soId: newSoId,
      partnerId: sjCustomer,
      paymentMethod: sjPaymentMethod,
      driver: sjDriver,
      vehicle: sjVehicle,
      createdAt: new Date().toISOString(),
      items: sjItems.map(it => ({
        productId: it.productId,
        qty: it.qty,
        price: it.price
      })),
    });

    showToast(`Surat Jalan ${newSjNumber} (${sjPaymentMethod}) disimpan offline & siap di-sync!`);
    setActiveTab('home');
  };

  const handleSaveBa = () => {
    const newBaNumber = `BA/2026/08/${String(purchasesList.length + 1).padStart(3, '0')}`;
    const totalCost = baQty * baPrice + Number(baTransport);

    const newBa = {
      id: String(Date.now()),
      number: newBaNumber,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      supplier: baSupplier,
      detail: `${baQty.toLocaleString('id-ID')} ${baCategory === 'BENIH' ? 'ekor' : 'kg'} · ${baSpecies} (${baSize})`,
      total: totalCost,
      status: baPaymentMethod,
      time: 'Baru saja',
    };

    setPurchasesList([newBa, ...purchasesList]);

    // Update dynamic metrics
    setMetrics(prev => ({
      ...prev,
      seedStock: baCategory === 'BENIH' ? prev.seedStock + baQty : prev.seedStock,
      cashBalance: baPaymentMethod === 'TUNAI' ? prev.cashBalance - totalCost : prev.cashBalance,
      payables: baPaymentMethod === 'HUTANG' ? prev.payables + totalCost : prev.payables,
    }));

    const newPoId = `PO_${Date.now()}`;
    void enqueueOutboxItem('DeliveryOrder', newPoId, 'CREATE', {
      poId: newPoId,
      partnerId: baSupplier,
      paymentMethod: baPaymentMethod,
      transportFee: Number(baTransport) || 0,
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: baProductId,
          qty: baQty,
          price: baPrice
        }
      ]
    });

    showToast(`Berita Acara ${newBaNumber} berhasil disimpan offline!`);
    setActiveTab('home');
  };

  const handleSaveExp = () => {
    const newExp = {
      id: String(Date.now()),
      category: expCategory,
      amount: expAmount,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      note: expNote,
    };
    setExpensesList([newExp, ...expensesList]);

    setMetrics(prev => ({
      ...prev,
      cashBalance: prev.cashBalance - expAmount,
    }));

    const newExpId = `EXP_${Date.now()}`;
    void enqueueOutboxItem('CashEntry', newExpId, 'CREATE', {
      expId: newExpId,
      category: expCategory,
      amount: expAmount,
      note: expNote,
      createdAt: new Date().toISOString(),
    });

    showToast(`Pengeluaran Rp ${expAmount.toLocaleString('id-ID')} dicatat!`);
    setActiveTab('home');
  };

  const handleAddMitra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMitraName.trim()) return;

    if (mitraType === 'CUSTOMER') {
      setCustomers([...customers, newMitraName]);
    } else {
      setSuppliers([...suppliers, newMitraName]);
    }

    showToast(`${newMitraName} ditambahkan sebagai ${mitraType === 'CUSTOMER' ? 'Pelanggan' : 'Pemasok'}`);
    setNewMitraName('');
    setNewMitraPhone('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bgGradient,
        color: colors.textDark,
        fontFamily: "'Inter', -apple-system, sans-serif",
        paddingBottom: 90,
        position: 'relative',
      }}
    >
      {/* 📱 1. HOME SCREEN */}
      {activeTab === 'home' && (
        <>
          {/* HEADER NAVY STYLE */}
          <header
            style={{
              background: '#0F1E3A',
              color: '#FFFFFF',
              padding: '24px 20px 24px',
              borderBottomRightRadius: 24,
              borderBottomLeftRadius: 24,
              boxShadow: '0 8px 32px rgba(15, 30, 58, 0.25)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', fontFamily: "'Space Grotesk', sans-serif", color: '#FFFFFF' }}>
                    {wsContext?.workspace.name || 'SUMBER LELE'}
                  </span>
                  <span style={{ background: colors.green, borderRadius: '50%', width: 8, height: 8, display: 'inline-block', boxShadow: `0 0 8px ${colors.green}` }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {wsContext?.blueprint?.name || 'UNREGISTERED BLUEPRINT'} · ACTIVE
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    borderRadius: 20,
                    padding: '6px 12px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.green }} />
                  OFFLINE ENGINE
                </button>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 📊 4 METRIC CARDS GRID (PREMIUM STYLING) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Budidaya: Siklus Aktif */}
              {isBudidaya && (
                <div style={{ background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: `${colors.green}18`, color: colors.green, borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>🌊</span>
                    <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>OFFLINE</span>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, fontWeight: 600 }}>Siklus Aktif</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: colors.textDark, marginTop: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {offlineMaster?.cycles?.length || 0}
                  </div>
                  <div style={{ fontSize: 9, color: colors.green, marginTop: 4, fontWeight: 700 }}>Tersimpan Lokal</div>
                </div>
              )}

              {/* Sales Metric */}
              {isDistributor && (
                <div style={{ background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: `${colors.green}18`, color: colors.green, borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>📈</span>
                  <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>PWA</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, fontWeight: 600 }}>Jual Hari Ini</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.textDark, marginTop: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {money(metrics.salesToday)}
                </div>
                <div style={{ fontSize: 9, color: colors.green, marginTop: 4, fontWeight: 700 }}>Platform Live</div>
              </div>
              )}

              {/* Seed Stock Metric */}
              {isDistributor && (
                <div style={{ background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: 'rgba(15, 30, 58, 0.1)', color: '#0F1E3A', borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>🐟</span>
                  <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>UOM</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, fontWeight: 600 }}>Stok Benih</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.textDark, marginTop: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {metrics.seedStock.toLocaleString('id-ID')} <span style={{ fontSize: 11, fontWeight: 600 }}>Ekor</span>
                </div>
                <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>3 Kolam penampungan</div>
              </div>
              )}

              {/* Cash Metric */}
              <div style={{ background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: 'rgba(255, 140, 66, 0.15)', color: colors.amber, borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>👛</span>
                  <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>KAS</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, fontWeight: 600 }}>Saldo Kas & Bank</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.textDark, marginTop: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {money(metrics.cashBalance)}
                </div>
                <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Kas & Transfer</div>
              </div>

              {/* Receivables Metric */}
              {isDistributor && (
                <div style={{ background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>📄</span>
                  <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>BUKU</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, fontWeight: 600 }}>Piutang Pelanggan</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.textDark, marginTop: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {money(metrics.receivables)}
                </div>
                <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Belum Lunas</div>
              </div>
              )}

              {/* Laba / Rugi Ringkas */}
              {finance?.netProfit !== undefined && (
                <div style={{ gridColumn: '1 / -1', background: colors.cardBg, borderRadius: 20, padding: 16, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'rgba(15, 147, 101, 0.1)', color: colors.green, borderRadius: 10, width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: 13 }}>📊</span>
                      <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>Estimasi Laba / Rugi Bersih</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: finance.netProfit >= 0 ? colors.green : '#EF4444', marginTop: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {money(finance.netProfit)}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '2px 6px', fontWeight: 700 }}>PWA</span>
                </div>
              )}
            </div>

            {/* ⚡ PREMIUM QUICK ACTIONS */}
            <div style={{ background: colors.cardBg, borderRadius: 24, padding: 18, border: `1px solid ${colors.border}`, boxShadow: '0 6px 18px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark }}>
                  {isDistributor ? 'Aksi Cepat Distributor' : isBudidaya ? 'Aksi Cepat Budidaya' : 'Aksi Cepat'}
                </span>
                <span style={{ fontSize: 10, color: colors.green, fontWeight: 700, letterSpacing: '0.05em' }}>OFFLINE SYNC ACTIVE</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDistributor ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 10 }}>
                {/* 1: Jual (Surat Jalan) */}
                {isDistributor && (
                  <button type="button" onClick={() => setActiveTab('jual')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: '#0F1E3A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(15, 30, 58, 0.3)' }}>🛒</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Surat Jalan</span>
                  </button>
                )}

                {/* 2: Beli (Berita Acara Penerimaan) */}
                {isDistributor && (
                  <button type="button" onClick={() => setActiveTab('beli')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: colors.green, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 14px ${colors.green}40` }}>📥</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Berita Acara</span>
                  </button>
                )}

                {/* BUDIDAYA ACTIONS */}
                {isBudidaya && (
                  <>
                    <button type="button" onClick={() => setActiveTab('pakan')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#0F1E3A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(15, 30, 58, 0.3)' }}>🌾</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Catat Pakan</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('kematian')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}>☠️</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Kematian</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('sampling')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: colors.green, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 14px ${colors.green}40` }}>⚖️</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Sampling</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab('panen')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: colors.amber, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 14px ${colors.amber}40` }}>🎣</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Panen</span>
                    </button>
                  </>
                )}

                {/* 3: Catat Biaya Pengeluaran */}
                <button type="button" onClick={() => setActiveTab('biaya')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: colors.amber, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 4px 14px ${colors.amber}40` }}>💸</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Catat Biaya</span>
                </button>

                {/* 4: Antrean Sync */}
                <button type="button" onClick={() => setActiveTab('sync')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,30,58,0.05)', color: colors.textDark, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔄</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.textDark }}>Sync Outbox</span>
                </button>
              </div>
            </div>

            {/* 📝 TRANSACTION LOGS LIST (Surat Jalan / Penjualan) */}
            {isDistributor && (
              <div style={{ background: colors.cardBg, borderRadius: 24, padding: 18, border: `1px solid ${colors.border}`, boxShadow: '0 6px 18px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark, marginBottom: 16 }}>
                Transaksi & Dokumen Terakhir
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {salesList.map((sj) => (
                  <div key={sj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: '#0F1E3A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {sj.customer[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: colors.textDark }}>{sj.customer}</div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{sj.detail}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: colors.textDark, fontFamily: "'Space Grotesk', sans-serif" }}>
                          Rp {(sj.total / 1000000).toFixed(2)}jt
                        </div>
                        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{sj.time}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrintDialogData({
                          title: 'Surat Jalan Penjualan',
                          number: sj.number,
                          date: sj.date,
                          partnerName: sj.customer,
                          partnerRole: 'Pelanggan',
                          items: sjItems.map(it => ({ name: `Benih ${it.fishName}`, sizeLabel: it.sizeLabel, qty: it.qty, price: it.price, total: it.qty * it.price })),
                          totalAmount: sj.total,
                          notes: sjNotes || 'Pembayaran COD di kolam.',
                          driver: sjDriver,
                          vehicle: sjVehicle,
                        })}
                        style={{
                          background: `${colors.green}18`,
                          border: `1px solid ${colors.green}30`,
                          color: colors.green,
                          borderRadius: 10,
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        🖨️ Cetak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </main>
        </>
      )}

      {/* 📱 TAB LAHAN / STOK BENIH PENAMPUNGAN */}
      {activeTab === 'lahan' && (
        <main style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark }}>🏞️ Kolam & Stok Benih Penampungan</h2>
          </div>

          {/* POOLS STOCK LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(!offlineMaster?.ponds || offlineMaster.ponds.length === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13, border: `1px dashed ${colors.border}`, borderRadius: 20 }}>
                Belum ada data kolam.
              </div>
            )}
            {offlineMaster?.ponds?.map((pond: any) => (
              <div key={pond.id} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, fontFamily: "'Space Grotesk', sans-serif" }}>{pond.name}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>Tipe: {pond.type || 'Penampungan'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: colors.textDark, fontFamily: "'Space Grotesk', sans-serif" }}>
                    -
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, marginTop: 2 }}>Stok Belum Tersedia Offline</div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* 📱 TAB GUDANG -> MASTER MITRA & RIWAYAT OFFLINE LOGS */}
      {activeTab === 'gudang' && (
        <main style={{ padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark, marginBottom: 16 }}>👥 Rekan Mitra & Log</h2>

          {/* SEGMENTED CONTROL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,30,58,0.05)', borderRadius: 14, padding: 4, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setGudangSegment('mitra')}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: gudangSegment === 'mitra' ? colors.cardBg : 'transparent',
                color: colors.textDark,
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              👥 Mitra Usaha (Master)
            </button>
            <button
              type="button"
              onClick={() => setGudangSegment('riwayat')}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: gudangSegment === 'riwayat' ? colors.cardBg : 'transparent',
                color: colors.textDark,
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              📑 Log Offline
            </button>
          </div>

          {/* SEGMENT A: MITRA */}
          {gudangSegment === 'mitra' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Form Tambah Mitra */}
              <form onSubmit={handleAddMitra} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>Tambah Rekan Mitra Baru</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setMitraType('CUSTOMER')}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${mitraType === 'CUSTOMER' ? colors.green : colors.border}`,
                      background: mitraType === 'CUSTOMER' ? `${colors.green}18` : 'transparent',
                      color: mitraType === 'CUSTOMER' ? colors.green : colors.textMuted,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Pelanggan
                  </button>
                  <button
                    type="button"
                    onClick={() => setMitraType('SUPPLIER')}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${mitraType === 'SUPPLIER' ? colors.green : colors.border}`,
                      background: mitraType === 'SUPPLIER' ? `${colors.green}18` : 'transparent',
                      color: mitraType === 'SUPPLIER' ? colors.green : colors.textMuted,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Pemasok (Supplier)
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={newMitraName}
                    onChange={(e) => setNewMitraName(e.target.value)}
                    placeholder="Nama Mitra *"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 13, fontWeight: 600 }}
                  />
                  <input
                    value={newMitraPhone}
                    onChange={(e) => setNewMitraPhone(e.target.value)}
                    placeholder="No. WhatsApp (Opsional)"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 13 }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: 'none',
                      background: isDark ? '#FFFFFF' : '#0F1E3A',
                      color: isDark ? '#0F1E3A' : '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Mitra Offline
                  </button>
                </div>
              </form>

              {/* List Mitra */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: colors.green, marginBottom: 8, letterSpacing: '0.05em' }}>DAFTAR PELANGGAN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {offlineMaster?.partners?.filter((p: any) => p.type === 'CUSTOMER').map((c: any) => <div key={c.id} style={{ fontSize: 13, fontWeight: 700, color: colors.textDark }}>{c.name}</div>) || <div style={{ fontSize: 12, color: colors.textMuted }}>Belum ada pelanggan</div>}
                  </div>
                </div>

                <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: colors.green, marginBottom: 8, letterSpacing: '0.05em' }}>DAFTAR PEMASOK</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {offlineMaster?.partners?.filter((p: any) => p.type === 'SUPPLIER').map((s: any) => <div key={s.id} style={{ fontSize: 13, fontWeight: 700, color: colors.textDark }}>{s.name}</div>) || <div style={{ fontSize: 12, color: colors.textMuted }}>Belum ada pemasok</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEGMENT B: OFFLINE LOGS */}
          {gudangSegment === 'riwayat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 12 }}>DAFTAR RIWAYAT DOKUMEN OFFLINE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {salesList.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingBottom: 8, borderBottom: `1px solid ${colors.border}` }}>
                      <span>📄 <b>{s.number}</b> ({s.customer})</span>
                      <span style={{ color: colors.green, fontWeight: 800 }}>{s.status}</span>
                    </div>
                  ))}
                  {purchasesList.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingBottom: 8, borderBottom: `1px solid ${colors.border}` }}>
                      <span>📥 <b>{p.number}</b> ({p.supplier})</span>
                      <span style={{ color: colors.amber, fontWeight: 800 }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* 📱 FORM TAMBAH PENJUALAN / SURAT JALAN (JUAL TAB) */}
      {activeTab === 'jual' && (
        <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 100 }}>
          {/* HEADER FORM */}
          <header style={{ background: '#0F1E3A', color: '#FFFFFF', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>Buat Surat Jalan Baru</h2>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Pendaftaran penjualan benih ke pelanggan offline.</div>
            </div>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: 22, cursor: 'pointer' }}>✕</button>
          </header>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. SEKSI METADATA DOKUMEN */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark, marginBottom: 12 }}>Metadata Dokumen</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Tanggal</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 13, fontWeight: 600, marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Pelanggan *</label>
                  <select
                    value={sjCustomer}
                    onChange={(e) => setSjCustomer(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 13, fontWeight: 700, marginTop: 4 }}
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {offlineMaster?.partners?.filter((p: any) => p.type === 'CUSTOMER').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>No. HP (Opsional)</label>
                    <input
                      value={sjPhone}
                      onChange={(e) => setSjPhone(e.target.value)}
                      placeholder="0812xxxx"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>Alamat</label>
                    <input
                      value={sjAlamat}
                      onChange={(e) => setSjAlamat(e.target.value)}
                      placeholder="Kab. Cianjur"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, marginTop: 4 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SEKSI ITEM KOMODITAS */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark }}>Item Komoditas Ikan</span>
                <button type="button" onClick={addSjItem} style={{ background: `${colors.green}18`, color: colors.green, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>+ Tambah</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sjItems.map((item, idx) => {
                  const itemSubtotal = item.qty * item.price;
                  const isSeedCategory = item.category === 'BENIH';
                  return (
                    <div key={item.id} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: colors.textDark }}>Item #{idx + 1}</span>
                        {sjItems.length > 1 && (
                          <button type="button" onClick={() => removeSjItem(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Hapus</button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: colors.textMuted }}>Pilih Produk (Wajib) *</label>
                          <select
                            value={item.productId || ''}
                            onChange={(e) => handleItemValueChange(item.id, 'productId', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 12, fontWeight: 700, marginTop: 2 }}
                          >
                            <option value="">-- Pilih Produk Master --</option>
                            {offlineMaster?.products?.map((f) => (
                              <option key={f.id} value={f.id}>{f.name} {f.sizeLabel ? `(${f.sizeLabel})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: colors.textMuted }}>Kategori Komoditas *</label>
                          <select
                            value={item.category}
                            onChange={(e) => handleItemValueChange(item.id, 'category', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 12, fontWeight: 700, marginTop: 2 }}
                          >
                            <option value="BENIH">Benih / Bibit Ikan (Ekor)</option>
                            <option value="IKAN_KONSUMSI">Ikan Konsumsi (Kg)</option>
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, color: colors.textMuted }}>Spesies Ikan</label>
                            <input
                              value={item.fishName}
                              onChange={(e) => handleItemValueChange(item.id, 'fishName', e.target.value)}
                              list={`sp-jual-${item.id}`}
                              placeholder="Ketik / pilih"
                              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 12, marginTop: 2 }}
                            />
                            <datalist id={`sp-jual-${item.id}`}>
                              {DEFAULT_SPECIES.map(sp => <option key={sp} value={sp} />)}
                            </datalist>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: colors.textMuted }}>Ukuran</label>
                            <input
                              value={item.sizeLabel}
                              onChange={(e) => handleItemValueChange(item.id, 'sizeLabel', e.target.value)}
                              list={`sz-jual-${item.id}`}
                              placeholder="Ketik / pilih"
                              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 12, marginTop: 2 }}
                            />
                            <datalist id={`sz-jual-${item.id}`}>
                              {DEFAULT_SIZES.map(sz => <option key={sz} value={sz} />)}
                            </datalist>
                          </div>
                        </div>

                        {/* Opsi Sampling / Berat khusus Benih */}
                        {isSeedCategory && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,30,58,0.02)', padding: 8, borderRadius: 10, border: `1px dashed ${colors.border}` }}>
                            <div>
                              <label style={{ fontSize: 9, color: colors.textMuted }}>Berat total (kg)</label>
                              <input
                                type="number"
                                value={item.weight || ''}
                                onChange={(e) => handleItemValueChange(item.id, 'weight', Number(e.target.value))}
                                placeholder="Misal: 12"
                                style={{ width: '100%', padding: '6px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 11, marginTop: 2 }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: colors.textMuted }}>Isi (ekor/kg)</label>
                              <input
                                type="number"
                                value={item.sampling || ''}
                                onChange={(e) => handleItemValueChange(item.id, 'sampling', Number(e.target.value))}
                                placeholder="Misal: 800"
                                style={{ width: '100%', padding: '6px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 11, marginTop: 2 }}
                              />
                            </div>
                            <div style={{ gridColumn: '1 / -1', fontSize: 9, color: colors.green, fontWeight: 700 }}>
                              * Qty otomatis dihitung: Berat × Sampling
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, color: colors.textMuted }}>Jumlah ({isSeedCategory ? 'Ekor' : 'Kg'}) *</label>
                            <input
                              type="number"
                              value={item.qty || ''}
                              onChange={(e) => handleItemValueChange(item.id, 'qty', Number(e.target.value))}
                              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 13, fontWeight: 800, marginTop: 2 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: colors.textMuted }}>Harga / {isSeedCategory ? 'Ekor' : 'Kg'} (Rp)</label>
                            <input
                              type="number"
                              value={item.price || ''}
                              onChange={(e) => handleItemValueChange(item.id, 'price', Number(e.target.value))}
                              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.textDark, fontSize: 13, fontWeight: 800, marginTop: 2 }}
                            />
                          </div>
                        </div>

                        <div style={{ fontSize: 12, fontWeight: 800, color: colors.green, marginTop: 4, textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif" }}>
                          Subtotal Rp {itemSubtotal.toLocaleString('id-ID')} · {item.qty.toLocaleString('id-ID')} {isSeedCategory ? 'Ekor' : 'Kg'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. PENGIRIMAN & BAYAR */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark, marginBottom: 12 }}>Pengiriman & Cara Bayar</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>Nama Armada / Sopir</label>
                    <input
                      value={sjDriver}
                      onChange={(e) => setSjDriver(e.target.value)}
                      placeholder="Armada"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>No. Polisi</label>
                    <input
                      value={sjVehicle}
                      onChange={(e) => setSjVehicle(e.target.value)}
                      placeholder="F xxxx xx"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, marginTop: 4 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>Status Pembayaran</label>
                    <select
                      value={sjPaymentMethod}
                      onChange={(e) => setSjPaymentMethod(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, fontWeight: 700, marginTop: 4 }}
                    >
                      <option value="TUNAI">Lunas / Tunai</option>
                      <option value="PIUTANG">Kredit / Piutang</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: colors.textMuted }}>Simpan ke Rekening</label>
                    <select
                      value={sjKasAccount}
                      onChange={(e) => setSjKasAccount(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, fontWeight: 700, marginTop: 4 }}
                    >
                      <option value="KAS">Kas Fisik / Laci</option>
                      <option value="BANK">Rekening Bank / Transfer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Keterangan / Catatan</label>
                  <input
                    value={sjNotes}
                    onChange={(e) => setSjNotes(e.target.value)}
                    placeholder="Catatan tambahan di nota..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, marginTop: 4 }}
                  />
                </div>
              </div>
            </div>

            {/* 4. TOTAL RINGKASAN TAGIHAN */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: colors.textMuted }}>Total Tagihan</span>
                <span style={{ fontWeight: 800, color: colors.textDark }}>Rp {totalSjAmount.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: colors.textMuted }}>Pembayaran Diterima</span>
                <span style={{ fontWeight: 800, color: colors.green }}>Rp {(sjPaymentMethod === 'TUNAI' ? totalSjAmount : 0).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: colors.textDark }}>Sisa Tagihan (Piutang)</span>
                <span style={{ fontWeight: 800, color: sjPaymentMethod === 'TUNAI' ? colors.textDark : '#FF8C42', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Rp {(sjPaymentMethod === 'TUNAI' ? 0 : totalSjAmount).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* 5. STICKY BOTTOM ACTIONS */}
            <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: '16px', background: colors.cardBg, borderTop: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, zIndex: 50 }}>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                style={{ height: 48, borderRadius: 14, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textDark, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSj}
                style={{
                  height: 48,
                  borderRadius: 14,
                  border: 'none',
                  background: colors.green,
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: `0 4px 12px ${colors.green}40`
                }}
              >
                Simpan Offline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 3. FORM BERITA ACARA PEMBELIAN (BELI TAB) */}
      {activeTab === 'beli' && (
        <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 100 }}>
          <header style={{ background: '#0F1E3A', color: '#FFFFFF', padding: '20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: 18, cursor: 'pointer' }}>←</button>
            <span style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Berita Acara Pembelian (BA)</span>
          </header>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Pemasok Metadata */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>PEMASOK / AGEN SUPPLIER</div>
              <select
                value={baSupplier}
                onChange={(e) => setBaSupplier(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700 }}
              >
                <option value="">-- Pilih Pemasok --</option>
                {offlineMaster?.partners?.filter((p: any) => p.type === 'SUPPLIER').map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Spek Benih */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 12, letterSpacing: '0.05em' }}>SPESIFIKASI KOMODITAS</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: colors.textMuted }}>Pilih Produk (Wajib) *</label>
                  <select
                    value={baProductId}
                    onChange={(e) => setBaProductId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, fontWeight: 700 }}
                  >
                    <option value="">-- Pilih Produk Master --</option>
                    {offlineMaster?.products?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} {f.sizeLabel ? `(${f.sizeLabel})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: colors.textMuted }}>Kategori Komoditas *</label>
                  <select
                    value={baCategory}
                    onChange={(e) => setBaCategory(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12, fontWeight: 700 }}
                  >
                    <option value="BENIH">Benih / Bibit Ikan (Ekor)</option>
                    <option value="IKAN_KONSUMSI">Ikan Konsumsi (Kg)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: colors.textMuted }}>Spesies Ikan</label>
                    <input
                      value={baSpecies}
                      onChange={(e) => setBaSpecies(e.target.value)}
                      list="sp-beli"
                      placeholder="Ketik/Pilih"
                      style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12 }}
                    />
                    <datalist id="sp-beli">
                      {DEFAULT_SPECIES.map(sp => <option key={sp} value={sp} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: colors.textMuted }}>Ukuran</label>
                    <input
                      value={baSize}
                      onChange={(e) => setBaSize(e.target.value)}
                      list="sz-beli"
                      placeholder="Ketik/Pilih"
                      style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 12 }}
                    />
                    <datalist id="sz-beli">
                      {DEFAULT_SIZES.map(sz => <option key={sz} value={sz} />)}
                    </datalist>
                  </div>
                </div>

                {baCategory === 'BENIH' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,30,58,0.02)', padding: 8, borderRadius: 10, border: `1px dashed ${colors.border}` }}>
                    <div>
                      <label style={{ fontSize: 9, color: colors.textMuted }}>Berat total (kg)</label>
                      <input
                        type="number"
                        value={baWeight || ''}
                        onChange={(e) => setBaWeight(Number(e.target.value))}
                        placeholder="Misal: 25"
                        style={{ width: '100%', padding: '6px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 11 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: colors.textMuted }}>Isi (ekor/kg)</label>
                      <input
                        type="number"
                        value={baSampling || ''}
                        onChange={(e) => setBaSampling(Number(e.target.value))}
                        placeholder="Misal: 800"
                        style={{ width: '100%', padding: '6px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 11 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Qty, Harga, Ongkir */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>JUMLAH & HARGA BELI</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Jumlah ({baCategory === 'BENIH' ? 'Ekor' : 'Kg'})</label>
                  <input
                    type="number"
                    value={baQty || ''}
                    onChange={(e) => setBaQty(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Harga per {baCategory === 'BENIH' ? 'Ekor' : 'Kg'} (Rp)</label>
                  <input
                    type="number"
                    value={baPrice || ''}
                    onChange={(e) => setBaPrice(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, marginTop: 4 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: colors.textMuted }}>Biaya Ongkos Angkut (Rp)</label>
                <input
                  type="number"
                  value={baTransport || ''}
                  onChange={(e) => setBaTransport(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700, marginTop: 4 }}
                />
              </div>
            </div>

            {/* Pembayaran BA */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>CARA PEMBAYARAN</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Cara Bayar</label>
                  <select
                    value={baPaymentMethod}
                    onChange={(e) => setBaPaymentMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700, marginTop: 4 }}
                  >
                    <option value="TUNAI">Lunas / Tunai</option>
                    <option value="HUTANG">Kredit / Hutang</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: colors.textMuted }}>Sumber Rekening</label>
                  <select
                    value={baKasAccount}
                    onChange={(e) => setBaKasAccount(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700, marginTop: 4 }}
                  >
                    <option value="KAS">Kas Fisik</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 5. STICKY BOTTOM ACTIONS */}
          <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: '16px', background: colors.cardBg, borderTop: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              style={{ height: 48, borderRadius: 14, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textDark, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveBa}
              style={{
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: colors.green,
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${colors.green}40`
              }}
            >
              Simpan Offline
            </button>
          </div>
        </div>
      )}

      {/* 📱 4. FORM CATAT PENGELUARAN (BIAYA TAB) */}
      {activeTab === 'biaya' && (
        <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 100 }}>
          <header style={{ background: '#0F1E3A', color: '#FFFFFF', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: 18, cursor: 'pointer' }}>←</button>
            <span style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Catat Pengeluaran Operasional</span>
          </header>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Kategori Pengeluaran sesuai Template */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>KATEGORI BIAYA</div>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700 }}
              >
                <option value="Operasional">Operasional Usaha</option>
                <option value="Transportasi">Transportasi / BBM</option>
                <option value="Gaji / Upah">Gaji / Upah Staf</option>
                <option value="Listrik & Air">Listrik & Air Kolam</option>
                <option value="Perawatan Kolam">Perawatan Kolam</option>
                <option value="Pakan Tambahan">Pakan Tambahan</option>
                <option value="Obat & Vitamin">Obat & Vitamin</option>
                <option value="Perlengkapan">Perlengkapan Kantor/Kolam</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>

            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>NOMINAL KAS KELUAR</div>
              <input
                type="number"
                value={expAmount || ''}
                onChange={(e) => setExpAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}
              />
            </div>

            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>CATATAN / KETERANGAN</div>
              <input
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="Deskripsi singkat pengeluaran..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontSize: 13 }}
              />
            </div>
          </div>

          {/* 5. STICKY BOTTOM ACTIONS */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: colors.cardBg, borderTop: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              style={{ height: 48, borderRadius: 14, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textDark, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveExp}
              style={{
                height: 48,
                borderRadius: 14,
                border: 'none',
                background: colors.amber,
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${colors.amber}40`
              }}
            >
              Catat Pengeluaran
            </button>
          </div>
        </div>
      )}

      {/* 📱 BUDIDAYA FORMS (PAKAN, KEMATIAN, SAMPLING, PANEN) */}
      {(activeTab === 'pakan' || activeTab === 'kematian' || activeTab === 'sampling' || activeTab === 'panen') && (
        <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 100 }}>
          <header style={{ background: '#0F1E3A', color: '#FFFFFF', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'capitalize' }}>Catat {activeTab}</h2>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Simpan offline untuk sinkronisasi nanti.</div>
            </div>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: 22, cursor: 'pointer' }}>✕</button>
          </header>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SIKLUS SELECTOR */}
            <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>PILIH SIKLUS AKTIF</div>
              <select
                value={bdiCycleId}
                onChange={(e) => setBdiCycleId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700 }}
              >
                <option value="">-- Pilih Siklus --</option>
                {offlineMaster?.cycles?.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.pond?.name} ({c.speciesProfile?.name})</option>
                ))}
              </select>
            </div>

            {/* FORM SPECIFIC FIELDS */}
            {activeTab === 'pakan' && (
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>PILIH PAKAN</div>
                  <select
                    value={bdiFeedId}
                    onChange={(e) => setBdiFeedId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 700 }}
                  >
                    <option value="">-- Pilih Jenis Pakan --</option>
                    {offlineMaster?.products?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} {f.brand ? `(${f.brand})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>JUMLAH PAKAN (KG)</div>
                  <input
                    type="number"
                    value={bdiQtyKg}
                    onChange={(e) => setBdiQtyKg(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, fontSize: 18 }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'kematian' && (
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>JUMLAH KEMATIAN (EKOR)</div>
                  <input
                    type="number"
                    value={bdiDeadPcs}
                    onChange={(e) => setBdiDeadPcs(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, fontSize: 18 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>PENYEBAB KEMATIAN (OPSIONAL)</div>
                  <input
                    type="text"
                    value={bdiMortalityCause}
                    onChange={(e) => setBdiMortalityCause(e.target.value)}
                    placeholder="Contoh: Jamur, Kualitas Air..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'sampling' && (
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>BERAT RATA-RATA (GRAM)</div>
                  <input
                    type="number"
                    value={bdiAvgWeight}
                    onChange={(e) => setBdiAvgWeight(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, fontSize: 18 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>JUMLAH SAMPEL (EKOR) (OPSIONAL)</div>
                  <input
                    type="number"
                    value={bdiSamplePcs}
                    onChange={(e) => setBdiSamplePcs(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'panen' && (
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>TOTAL PANEN (KG)</div>
                  <input
                    type="number"
                    value={bdiHarvestKg}
                    onChange={(e) => setBdiHarvestKg(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark, fontWeight: 800, fontSize: 18 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted, marginBottom: 8, letterSpacing: '0.05em' }}>ESTIMASI JUMLAH EKOR (OPSIONAL)</div>
                  <input
                    type="number"
                    value={bdiHarvestPcs}
                    onChange={(e) => setBdiHarvestPcs(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.textDark }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* STICKY BOTTOM ACTIONS */}
          <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: '16px', background: colors.cardBg, borderTop: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              style={{ height: 48, borderRadius: 14, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textDark, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'pakan') handleSaveBudidaya('FeedEvent');
                if (activeTab === 'kematian') handleSaveBudidaya('MortalityEvent');
                if (activeTab === 'sampling') handleSaveBudidaya('SamplingEvent');
                if (activeTab === 'panen') handleSaveBudidaya('HarvestEvent');
              }}
              style={{ height: 48, borderRadius: 14, background: colors.green, color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 12px ${colors.green}40` }}
            >
              Simpan Offline
            </button>
          </div>
        </div>
      )}

      {/* 📱 5. SETTINGS / CONFIG TAB */}
      {activeTab === 'settings' && (
        <main style={{ padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: colors.textDark, marginBottom: 16 }}>⚙️ Pengaturan & Tema Visual</h2>
          
          <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Pilihan Tema UI</div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Sesuaikan tema dengan mode gelap/terang Landing Page.</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: '#F9FBF7',
                    color: '#0F1E3A',
                    border: `2px solid ${!isDark ? colors.green : 'transparent'}`,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ☀️ Terang (Light)
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: '#0F1E3A',
                    color: '#FFFFFF',
                    border: `2px solid ${isDark ? colors.green : 'transparent'}`,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  🌙 Gelap (Dark)
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: colors.border }} />

            <div>
              <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Mode Tampilan</div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Buka versi desktop jika menggunakan layar lebar.</div>
              <button
                type="button"
                onClick={() => { window.location.href = window.location.pathname; }}
                style={{ width: '100%', padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, color: colors.textDark, borderRadius: 14, fontWeight: 800, fontSize: 13, marginTop: 10, cursor: 'pointer' }}
              >
                🖥️ Buka Versi Desktop
              </button>
            </div>

            <div style={{ height: 1, background: colors.border }} />

            <button
              type="button"
              onClick={onLogout}
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 14, padding: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              Keluar Akun Member
            </button>
          </div>
        </main>
      )}

      {/* 📱 FIXED BOTTOM APP NAVIGATION DOCK (WITH PERFECTLY CENTERED GREEN (+) BUTTON) */}
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
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          zIndex: 90,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* Blueprint-specific Bottom Navigation */}
        {isDistributor ? (
          <>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'transparent', border: 'none', color: activeTab === 'home' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🏠</span><span style={{ fontSize: 9 }}>Beranda</span>
            </button>
            <button type="button" onClick={() => setActiveTab('jual')} style={{ background: 'transparent', border: 'none', color: activeTab === 'jual' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>📤</span><span style={{ fontSize: 9 }}>Jual</span>
            </button>
            <button type="button" onClick={() => setActiveTab('beli')} style={{ background: 'transparent', border: 'none', color: activeTab === 'beli' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>📥</span><span style={{ fontSize: 9 }}>Beli</span>
            </button>
            <button type="button" onClick={() => setActiveTab('biaya')} style={{ background: 'transparent', border: 'none', color: activeTab === 'biaya' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>💸</span><span style={{ fontSize: 9 }}>Kas</span>
            </button>
            <button type="button" onClick={() => setActiveTab('settings')} style={{ background: 'transparent', border: 'none', color: activeTab === 'settings' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>⚙️</span><span style={{ fontSize: 9 }}>Menu</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setActiveTab('home')} style={{ background: 'transparent', border: 'none', color: activeTab === 'home' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🏠</span><span style={{ fontSize: 9 }}>Beranda</span>
            </button>
            <button type="button" onClick={() => setActiveTab('pakan')} style={{ background: 'transparent', border: 'none', color: activeTab === 'pakan' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🌾</span><span style={{ fontSize: 9 }}>Pakan</span>
            </button>
            <button type="button" onClick={() => setActiveTab('kematian')} style={{ background: 'transparent', border: 'none', color: activeTab === 'kematian' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>☠️</span><span style={{ fontSize: 9 }}>Mati</span>
            </button>
            <button type="button" onClick={() => setActiveTab('panen')} style={{ background: 'transparent', border: 'none', color: activeTab === 'panen' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🎣</span><span style={{ fontSize: 9 }}>Panen</span>
            </button>
            <button type="button" onClick={() => setActiveTab('settings')} style={{ background: 'transparent', border: 'none', color: activeTab === 'settings' ? colors.green : colors.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>⚙️</span><span style={{ fontSize: 9 }}>Menu</span>
            </button>
          </>
        )}
      </nav>

      {/* 🍞 TOAST NOTIFICATION SYSTEM */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, left: 20, right: 20, zIndex: 9999,
          background: toastMsg.type === 'error' ? '#FF4C4C' : colors.green,
          color: '#FFF', padding: '16px 20px', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span style={{ fontSize: 20 }}>{toastMsg.type === 'error' ? '⚠️' : '✅'}</span>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{toastMsg.text}</span>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />

      {/* 🖨️ DUAL PRINT OPTIONS DIALOG */}
      <PrintDialog
        data={printDialogData}
        onClose={() => setPrintDialogData(null)}
      />
    </div>
  );
}
