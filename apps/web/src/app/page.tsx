"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { authApi, platformApi, erpApi, cycleApi, serviceApi, tumbuFetch } from '../tumbu-api';
import { PlatformPages } from './platform-pages';
import { DistributorPages } from './distributor-pages';
import { AquaPages } from './aqua-pages';
import { ServicePages } from './service-pages';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, ArrowRight, Check, Zap, Database, Smartphone,
  Fish, Package, Layers, TrendingUp, Users, CreditCard,
  FileText, MapPinned, AlertTriangle, DollarSign, BarChart3,
  ChevronDown, Play, X, Menu, Building2, Waves, Shuffle,
  Boxes, HeartPulse, Scale, LayoutDashboard, Settings, LogOut,
  Activity, Timer, Droplets, Bird, ChevronRight, Sparkles,
  ShieldCheck, WifiOff, RefreshCw, Store, Sprout, Link2, Home,
  PanelLeftClose, PanelLeft, Download, Share2, Info, ChevronLeft,
  CheckCircle2, HardDrive, Cpu, Lock, ArrowUpRight, CloudOff,
  FileCheck, Truck, Bot, UserCheck, Mic, Copy, Volume2, VolumeX,
  Terminal, UserPlus, ExternalLink, Printer
} from 'lucide-react';
import { PlatformAdminSkin } from './products/platform/PlatformAdminSkin';
import { DistributorSkin } from './products/distributor/DistributorSkin';
import { PembudidayaSkin } from './products/pembudidaya/PembudidayaSkin';
import { printSuratJalanPdf, printBeritaAcaraPdf, printKwitansiPdf, printClosingReportPdf } from './print';

// Local images
const logoIconUrl = "/tumbu-icon-removebg-preview-1.png";
const logoSymbolUrl = "/tumbu-icon-removebg-preview-1.png";

// Helper functions for safe decimal parsing & formatting
function parseDecimal(val: unknown): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }

  if (typeof val === 'string') {
    const parsed = Number.parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof val === 'object' && 'toString' in val) {
    const parsed = Number.parseFloat(String(val));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatRupiah(value: any): string {
  const num = parseDecimal(value);
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

function formatNumber(value: any): string {
  const num = parseDecimal(value);
  return num.toLocaleString('id-ID');
}



type Theme = 'light' | 'dark';
type AppView = 'landing' | 'auth' | 'blueprintSelect' | 'setup' | 'workspaceSelect' | 'distributor' | 'budidaya' | 'platform' | 'integrasi';
type FeatureTab = 'distributor' | 'budidaya' | 'offline';

type BlueprintChoice = 'distributor' | 'budidaya';

const BLUEPRINT_IDS: Record<BlueprintChoice, string> = {
  distributor: 'operational_distributor',
  budidaya: 'operational_aquaculture_freshwater',
};

const reveal = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

type Product = {
  size: string;
  stock: number;
  price: number;
  sold: number;
  unit: string;
  commodityCategory: string;
};

type Cycle = {
  id: string;
  pond: string;
  doc: number;
  sr: number;
  abw: number;
  biomass: number;
  state: string;
};

type TransactionRecord = {
  id: string;
  sjNumber: string;
  date: string;
  customerName: string;
  type: 'SALE' | 'PURCHASE';
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: 'LUNAS' | 'TEMPO';
  dueDate?: string;
  connectedSupplyChain?: boolean;
  pondDestination?: string;
  notes?: string;
};

// 1. BACKEND MODULES UNTUK DISTRIBUTOR BENIH
const DISTRIBUTOR_MODULES = [
  { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard, category: 'DASHBOARD' },
  { id: 'sales', label: 'Penjualan', icon: FileText, category: 'OPERASIONAL' },
  { id: 'purchase', label: 'Purchase Order / PO', icon: Boxes, category: 'OPERASIONAL' },
  { id: 'beritaacara', label: 'Berita Acara', icon: FileCheck, category: 'OPERASIONAL' },
  { id: 'suratjalan', label: 'Surat Jalan', icon: Truck, category: 'OPERASIONAL' },
  { id: 'inventory', label: 'Stok Benih & Pakan', icon: Package, category: 'OPERASIONAL' },
  { id: 'expense', label: 'Pengeluaran', icon: DollarSign, category: 'KEUANGAN' },
  { id: 'cash', label: 'Kas & Bank', icon: CreditCard, category: 'KEUANGAN' },
  { id: 'receivable', label: 'Piutang Mitra', icon: BarChart3, category: 'KEUANGAN' },
  { id: 'payable', label: 'Hutang Supplier', icon: Scale, category: 'KEUANGAN' },
  { id: 'tutupbuku', label: 'Tutup Buku / Closing', icon: Lock, category: 'KEUANGAN' },
  { id: 'integrasi_pasok', label: 'Rantai Pasok', icon: Link2, category: 'DATA' },
  { id: 'reports', label: 'Laporan Usaha', icon: FileText, category: 'KEUANGAN' },
  { id: 'master', label: 'Master Data', icon: Layers, category: 'DATA' },
  { id: 'settings', label: 'Pengaturan Identitas', icon: Settings, category: 'SISTEM' },
  { id: 'ai_tumbu', label: 'AI TUMBU MEMBER', icon: Bot, category: 'ASISTEN AI' },
];

// ... (KEEP existing BUDIDAYA_MODULES and PLATFORM_MODULES)

// Dynamic Module Mapping based on BusinessType
export type BusinessType = 'CULTIVATOR' | 'SEED_DISTRIBUTOR' | 'FEED_DISTRIBUTOR' | 'EQUIPMENT_SUPPLIER' | 'HARVEST_OFFTAKER' | 'PROCESSED_FOOD_PRODUCER' | 'LOGISTICS_TRANSPORTER' | 'CONSULTANT_LAB_SERVICE';

function getModulesForBusiness(type?: string): any[] {
  if (!type) return DISTRIBUTOR_MODULES; // Fallback
  
  const t = type.toLowerCase();
  switch (t) {
    case 'budidaya':
    case 'cultivator': 
      return BUDIDAYA_MODULES;
    case 'service':
    case 'service_jasa':
    case 'service_teknisi_perikanan':
    case 'consultant_lab_service':
    case 'jasa':
      return SERVICE_MODULES;
    case 'distributor':
    case 'seed_distributor':
    case 'feed_distributor':
    case 'equipment_supplier':
      return DISTRIBUTOR_MODULES;
    default:
      return DISTRIBUTOR_MODULES; 
  }
}

// 1.5. BACKEND MODULES UNTUK TEKNISI & JASA PERIKANAN
const SERVICE_MODULES = [
  { id: 'dashboard', label: 'Dashboard Layanan', icon: LayoutDashboard, category: 'DASHBOARD' },
  { id: 'customers', label: 'Pelanggan', icon: Users, category: 'OPERASIONAL' },
  { id: 'services', label: 'Katalog Layanan', icon: Layers, category: 'OPERASIONAL' },
  { id: 'quotations', label: 'Penawaran & Survey', icon: FileText, category: 'OPERASIONAL' },
  { id: 'orders', label: 'Pesanan / Work Order', icon: CheckCircle2, category: 'OPERASIONAL' },
  { id: 'schedule', label: 'Jadwal Kerja', icon: Activity, category: 'OPERASIONAL' },
  { id: 'technicians', label: 'Teknisi / Tim', icon: UserCheck, category: 'OPERASIONAL' },
  { id: 'assets', label: 'Unit & Peralatan', icon: Cpu, category: 'OPERASIONAL' },
  { id: 'kas', label: 'Kas & Bank', icon: CreditCard, category: 'KEUANGAN' },
  { id: 'pengeluaran', label: 'Biaya Operasional', icon: DollarSign, category: 'KEUANGAN' },
  { id: 'invoice', label: 'Invoice & Pembayaran', icon: FileCheck, category: 'KEUANGAN' },
  { id: 'keuangan', label: 'Laba Rugi', icon: TrendingUp, category: 'KEUANGAN' },
  { id: 'laporan', label: 'Laporan', icon: BarChart3, category: 'DATA' },
  { id: 'members', label: 'Anggota Usaha', icon: UserPlus, category: 'SISTEM' },
  { id: 'settings', label: 'Pengaturan Usaha', icon: Settings, category: 'SISTEM' },
];

// 2. BACKEND MODULES UNTUK BUDIDAYA AIR TAWAR
const BUDIDAYA_MODULES = [
  { id: 'dashboard', label: 'Dashboard Budidaya', icon: LayoutDashboard, category: 'DASHBOARD' },
  { id: 'kolam_siklus', label: 'Kolam & Siklus', icon: Waves, category: 'OPERASIONAL' },
  { id: 'pakan_fcr', label: 'Recording Pakan & FCR', icon: Activity, category: 'OPERASIONAL' },
  { id: 'tebar', label: 'Tebar & Sampling', icon: Fish, category: 'OPERASIONAL' },
  { id: 'kualitas_air', label: 'Kualitas Air', icon: Droplets, category: 'OPERASIONAL' },
  { id: 'panen_close', label: 'Panen & Laba-Rugi', icon: Scale, category: 'OPERASIONAL' },
  { id: 'expense', label: 'Biaya Operasional', icon: DollarSign, category: 'OPERASIONAL' },
  { id: 'cash', label: 'Kas & Bank', icon: CreditCard, category: 'KEUANGAN' },
  { id: 'tutupbuku', label: 'Tutup Siklus / Buku', icon: Lock, category: 'KEUANGAN' },
  { id: 'integrasi_pasok', label: 'Rantai Pasok', icon: Link2, category: 'DATA' },
  { id: 'settings', label: 'Pengaturan Tambak', icon: Settings, category: 'SISTEM' },
  { id: 'ai_tumbu', label: 'AI TUMBU MEMBER', icon: Bot, category: 'ASISTEN AI' },
];

// 3. BACKEND MODULES UNTUK PLATFORM ADMIN MASTER
const PLATFORM_MODULES = [
  { id: 'overview', label: 'Control Center', icon: LayoutDashboard, category: 'CONTROL PLANE' },
  { id: 'workspaces', label: 'Daftar Workspace Member', icon: Building2, category: 'CONTROL PLANE' },
  { id: 'leads', label: 'Daftar Minat / Leads', icon: Activity, category: 'CONTROL PLANE' },
  { id: 'blueprints', label: 'Katalog Blueprint Usaha', icon: Layers, category: 'KONFIGURASI' },
  { id: 'modules', label: 'Modul System Master', icon: Boxes, category: 'KONFIGURASI' },
  { id: 'plans', label: 'Paket Langganan', icon: CreditCard, category: 'KEUANGAN PLATFORM' },
  { id: 'billing', label: 'Profil Billing & Tagihan', icon: FileText, category: 'KEUANGAN PLATFORM' },
  { id: 'members', label: 'Anggota & Akses Master', icon: Users, category: 'AKSES & KEAMANAN' },
  { id: 'audit', label: 'Audit Trail & Log System', icon: ShieldCheck, category: 'AKSES & KEAMANAN' },
  { id: 'settings', label: 'Pengaturan System Master', icon: Settings, category: 'SISTEM MASTER' },
  { id: 'ai_tumbu', label: 'AI TUMBU PLATFORM', icon: Bot, category: 'CONTROL PLANE' },
];

export default function Page() {
  const [theme, setTheme] = useState<Theme>('light');
  const [solusiOpen, setSolusiOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featureTab, setFeatureTab] = useState<FeatureTab>('offline');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [view, setView] = useState<AppView>('landing');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintChoice>('distributor');
  const [platformTab, setPlatformTab] = useState<'overview' | 'billing' | 'settings' | 'audit' | 'ai_tumbu'>('overview');
  const [workspaceModuleTab, setWorkspaceModuleTab] = useState<string>('dashboard');
  const [dashboardAiPrompt, setDashboardAiPrompt] = useState<string>('');
  const [budidayaStateFilter, setBudidayaStateFilter] = useState<'ALL' | 'GROWING' | 'HARVESTED' | 'CLOSED'>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Sidebar controls
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  // PWA states
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  // Auth + workspace session
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authAgreedTerms, setAuthAgreedTerms] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      return tumbuFetch(path, authToken || undefined, init);
    },
    [authToken],
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [workspaceContext, setWorkspaceContext] = useState<any>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null);

  // Workspace Members & Invitations State
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmailOrId, setInviteEmailOrId] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER'>('STAFF');

  // Live data states
  const [products, setProducts] = useState<Product[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Platform Admin Live Data States
  const [platformOverview, setPlatformOverview] = useState<any>(null);
  const [platformWorkspacesList, setPlatformWorkspacesList] = useState<any[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);

  // Real ERP Transactions State (Sales & Supply Chain)
  const [salesTransactions, setSalesTransactions] = useState<TransactionRecord[]>([]);

  // Modal controls
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [showQuickActionsDropdown, setShowQuickActionsDropdown] = useState(false);
  const [showHuluHilirModal, setShowHuluHilirModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TransactionRecord | null>(null);

  // New states for master data & reports
  const [masterTab, setMasterTab] = useState<'petani' | 'komoditas'>('petani');
  const [masterPetani, setMasterPetani] = useState<Array<{ id: string; nama: string; lokasi: string; komoditas: string; status: string }>>([]);
  const [masterKomoditas, setMasterKomoditas] = useState<Array<{ id: string; nama: string; tipe: string; harga: number; satuan: string }>>([]);

  // Form fields for adding master data
  const [showAddPetaniModal, setShowAddPetaniModal] = useState(false);
  const [newPetaniNama, setNewPetaniNama] = useState('');
  const [newPetaniLokasi, setNewPetaniLokasi] = useState('');
  const [newPetaniKomoditas, setNewPetaniKomoditas] = useState('');

  const [showAddKomoditasModal, setShowAddKomoditasModal] = useState(false);
  const [newKomoditasNama, setNewKomoditasNama] = useState('');
  const [newKomoditasTipe, setNewKomoditasTipe] = useState('Benih');
  const [newKomoditasHarga, setNewKomoditasHarga] = useState('');
  const [newKomoditasSatuan, setNewKomoditasSatuan] = useState('ekor');

  // Purchase Order states
  const [purchaseItems, setPurchaseItems] = useState<Array<{ namaItem: string; jumlah: string; hargaSatuan: string }>>([
    { namaItem: 'Kulakan Benih / Pakan', jumlah: '', hargaSatuan: '' }
  ]);
  const [purchaseBiayaLain, setPurchaseBiayaLain] = useState<Array<{ keterangan: string; jumlahRp: string }>>([]);

  const handleAddPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { namaItem: 'Kulakan Benih / Pakan', jumlah: '', hargaSatuan: '' }]);
  };

  const handleRemovePurchaseItem = (index: number) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
    }
  };

  const handlePurchaseItemChange = (index: number, field: 'namaItem' | 'jumlah' | 'hargaSatuan', value: string) => {
    const next = [...purchaseItems];
    next[index] = { ...next[index], [field]: value };
    setPurchaseItems(next);
  };

  const handleAddPurchaseBiayaLain = () => {
    setPurchaseBiayaLain([...purchaseBiayaLain, { keterangan: '', jumlahRp: '' }]);
  };

  const handleRemovePurchaseBiayaLain = (index: number) => {
    setPurchaseBiayaLain(purchaseBiayaLain.filter((_, i) => i !== index));
  };

  const handlePurchaseBiayaLainChange = (index: number, field: 'keterangan' | 'jumlahRp', value: string) => {
    const next = [...purchaseBiayaLain];
    next[index] = { ...next[index], [field]: value };
    setPurchaseBiayaLain(next);
  };

  // Form fields for adding new sale
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleItem, setSaleItem] = useState('');
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [salePaymentStatus, setSalePaymentStatus] = useState<'LUNAS' | 'TEMPO' | 'DP'>('LUNAS');
  const [saleDpAmount, setSaleDpAmount] = useState('');
  const [saleAdjustmentType, setSaleAdjustmentType] = useState<'NONE' | 'EXTRA' | 'DISCOUNT'>('NONE');
  const [saleAdjustmentValue, setSaleAdjustmentValue] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [savingSale, setSavingSale] = useState(false);

  // Multi-item & Biaya Lain states
  const [saleItems, setSaleItems] = useState<Array<{ namaItem: string; jumlah: string; hargaSatuan: string }>>([
    { namaItem: '', jumlah: '', hargaSatuan: '' }
  ]);
  const [saleBiayaLain, setSaleBiayaLain] = useState<Array<{ keterangan: string; jumlahRp: string }>>([]);

  const handleAddItem = () => {
    setSaleItems([...saleItems, { namaItem: '', jumlah: '', hargaSatuan: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (saleItems.length > 1) {
      setSaleItems(saleItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: 'namaItem' | 'jumlah' | 'hargaSatuan', value: string) => {
    const next = [...saleItems];
    next[index] = { ...next[index], [field]: value };
    setSaleItems(next);
  };

  const handleAddBiayaLain = () => {
    setSaleBiayaLain([...saleBiayaLain, { keterangan: '', jumlahRp: '' }]);
  };

  const handleRemoveBiayaLain = (index: number) => {
    setSaleBiayaLain(saleBiayaLain.filter((_, i) => i !== index));
  };

  const handleBiayaLainChange = (index: number, field: 'keterangan' | 'jumlahRp', value: string) => {
    const next = [...saleBiayaLain];
    next[index] = { ...next[index], [field]: value };
    setSaleBiayaLain(next);
  };

  // New item form state for ERP inventory
  const [newProductName, setNewProductName] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);

  // Platform Console Admin Forms
  const [billingCompany, setBillingCompany] = useState('Tumbu Hybrid Business OS');
  const [billingBank, setBillingBank] = useState('Bank Central Asia (BCA)');
  const [billingAccountNo, setBillingAccountNo] = useState('8830-1928-1029');
  const [billingAccountName, setBillingAccountName] = useState('Tumbu Hybrid Business OS');
  const [billingTaxNo, setBillingTaxNo] = useState('01.234.567.8-012.000');
  const [billingEmail, setBillingEmail] = useState('billing@tumbu.app');
  const [billingPhone, setBillingPhone] = useState('0812-9900-1122');
  const [platformQuota, setPlatformQuota] = useState('10');
  const [platformTrialDays, setPlatformTrialDays] = useState('14');
  const [platformAutoApprove, setPlatformAutoApprove] = useState(true);

  // Operational Expenses State (Distributor & Budidaya)
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [expCategory, setExpCategory] = useState('Transportasi & BBM Armada');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAccount, setExpAccount] = useState<'CASH' | 'BANK'>('CASH');

  // Cash & Bank Entries State
  const [cashEntriesList, setCashEntriesList] = useState<any[]>([]);
  const [cashDir, setCashDir] = useState<'IN' | 'OUT'>('IN');
  const [cashAcc, setCashAcc] = useState<'CASH' | 'BANK'>('CASH');
  const [cashAmt, setCashAmt] = useState('');
  const [cashCat, setCashCat] = useState('Kas Masuk');
  const [cashNote, setCashNote] = useState('');

  // Kwitansi / Receipts State
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [newKwPayer, setNewKwPayer] = useState('');
  const [newKwAmount, setNewKwAmount] = useState('');
  const [newKwDesc, setNewKwDesc] = useState('');
  const [newKwMethod, setNewKwMethod] = useState('TUNAI / KAS');

  // Purchases / Purchase Orders (PO) State
  const [purchasesList, setPurchasesList] = useState<any[]>([]);
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseItem, setPurchaseItem] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePaymentStatus, setPurchasePaymentStatus] = useState<'LUNAS' | 'TEMPO' | 'DP'>('LUNAS');
  const [purchaseDpAmount, setPurchaseDpAmount] = useState('');
  const [purchaseAdjustmentType, setPurchaseAdjustmentType] = useState<'NONE' | 'EXTRA' | 'DISCOUNT'>('NONE');
  const [purchaseAdjustmentValue, setPurchaseAdjustmentValue] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Berita Acara state (Serah Terima Pembelian Ikan dari Petani ke Distributor)
  const [showAddBaModal, setShowAddBaModal] = useState(false);
  const [baFilter, setBaFilter] = useState<'ALL' | 'BELUM_IMPORT' | 'DIIMPORT_PO'>('ALL');
  const [baPetani, setBaPetani] = useState('');
  const [baKomoditas, setBaKomoditas] = useState('Benih Lele Sangkuriang (5-7 cm)');
  const [baBakCount, setBaBakCount] = useState(2);
  const [baNotes, setBaNotes] = useState('');
  
  // State for dynamic sekatan per bak
  const [baSekatanData, setBaSekatanData] = useState<Array<{ label: string; awalPetani: number; ulangDistributor: number }>>([
    { label: 'Sekat Depan', awalPetani: 0, ulangDistributor: 0 },
    { label: 'Sekat Tengah', awalPetani: 0, ulangDistributor: 0 },
    { label: 'Sekat Belakang', awalPetani: 0, ulangDistributor: 0 }
  ]);

  const [beritaAcaraList, setBeritaAcaraList] = useState<any[]>([]);
  const [selectedBaForPrint, setSelectedBaForPrint] = useState<any | null>(null);

  // Surat Jalan (SJ) state - PURE LOGISTICS SHIPMENT (NO PRICES/RUPIAH)
  const [showAddSjModal, setShowAddSjModal] = useState(false);
  const [sjRecipient, setSjRecipient] = useState('');
  const [sjAddress, setSjAddress] = useState('');
  const [sjDriverName, setSjDriverName] = useState('');
  const [sjVehiclePlate, setSjVehiclePlate] = useState('');
  const [sjItemName, setSjItemName] = useState('Benih Nila Merah Grade A (5-7cm)');
  const [sjTotalKoli, setSjTotalKoli] = useState('1');
  const [sjTotalEkor, setSjTotalEkor] = useState('0');
  const [sjNotes, setSjNotes] = useState('');
  
  const [suratJalanList, setSuratJalanList] = useState<any[]>([]);

  // Tutup Buku state
  const [closingPeriodYm, setClosingPeriodYm] = useState('2026-08');
  const [showPreviewClosingModal, setShowPreviewClosingModal] = useState(false);
  const [closingHistory, setClosingHistory] = useState<any[]>([]);

  // Farm & Distributor Identity Settings State
  const [farmIdentity, setFarmIdentity] = useState({
    name: 'TUMBU Distributor & Tambak Perikanan',
    owner: 'Pak Alfirmansyah',
    phone: '0812-3456-7890',
    address: 'Jl. Raya Perikanan No. 88, Kediri, Jawa Timur',
    npwp: '31.415.926.5-012.000',
    bankName: 'Bank Central Asia (BCA)',
    bankAccount: '8830-1928-1029',
    bankHolder: 'Alfirmansyah',
    logoUrl: logoIconUrl,
  });

  // Platform Admin Search & Filter States
  const [platformSearch, setPlatformSearch] = useState('');
  const [platformStatusFilter, setPlatformStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED'>('ALL');

  // Platform Team Access Control State (RBAC)
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamRole, setNewTeamRole] = useState<'OWNER' | 'TEKNISI' | 'ASISTEN'>('TEKNISI');
  const [platformTeamMembers, setPlatformTeamMembers] = useState<any[]>([
    {
      id: 'team-1',
      name: 'Pak Alfirmansyah',
      email: 'Alfirmansyah.sni@gmail.com',
      role: 'OWNER',
      status: 'AKTIF',
      permissions: ['Full Master System Access', 'Billing & Rekening', 'Hapus Workspace', 'Security Audit Logs'],
    },
  ]);

  // Meta AI Quick Chat Drawer State
  const [showMetaAiChat, setShowMetaAiChat] = useState(false);
  const [metaAiMessages, setMetaAiMessages] = useState<any[]>([
    {
      sender: 'agent',
      text: 'Assalammualaikum bos, mau ngapain kita hari ini ? ada yang bisa gue bantu?',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [metaAiInput, setMetaAiInput] = useState('');
  const [metaAiLoading, setMetaAiLoading] = useState(false);

  // Interactive Landing AI Demo State
  const [demoAiSelectedPrompt, setDemoAiSelectedPrompt] = useState<number | null>(null);
  const [demoAiFeed, setDemoAiFeed] = useState(120); // sak
  const [demoAiHarvest, setDemoAiHarvest] = useState(1500); // kg
  const [demoAiExpense, setDemoAiExpense] = useState(42000000); // Rupiah
  const [demoAiIsTyping, setDemoAiIsTyping] = useState(false);

  // Typewriter and Voice sample states for the Landing Page
  const [landingAiTab, setLandingAiTab] = useState<number>(0);
  const [typewriterText, setTypewriterText] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(true);
  const [copiedInviteId, setCopiedInviteId] = useState<boolean>(false);
  const [pwaToastMsg, setPwaToastMsg] = useState<string | null>(null);

  const aiVoiceSamples = useMemo(() => [
    {
      tabLabel: "Contoh 1",
      voiceText: "Catat panen lele 500kg dari Kolam A3, harga 22rb",
      aiReply: "Siap Bos, tercatat 500kg x Rp22.000 = Rp11.000.000.\nStok Kolam A3 sisa 1.200 ekor. Mau buat BA?",
      chips: ["✓ Tercatat", "BA? - Ya / Nanti"],
      latency: "≤120ms",
      context: "Kolam A3",
      action: "Auto BA",
      feed: 120,
      harvest: 2000,
      expense: 42000000
    },
    {
      tabLabel: "Contoh 2",
      voiceText: "Tadi pakan nila Kolam B2 habis 2 sak pelet -2, mortalitas 5 ekor",
      aiReply: "Siap Bos! Terpotong stok pakan 2 sak (50kg), sisa gudang 38 sak.\nKolam B2 mortalitas 5 ekor tercatat. SR 97.8%.",
      chips: ["✓ Pakan Terpotong", "SR Updated"],
      latency: "≤95ms",
      context: "Kolam B2",
      action: "Update FCR",
      feed: 118,
      harvest: 1500,
      expense: 42000000
    },
    {
      tabLabel: "Contoh 3",
      voiceText: "Beli solar genset 15 liter 180rb pakai uang kas kecil",
      aiReply: "Siap Bos! Pengeluaran Rp180.000 (Biaya Energi/Genset) masuk Buku Kas.\nSaldo kas kecil tersisa Rp2.320.000.",
      chips: ["✓ Kas Keluar", "Saldo Aman"],
      latency: "≤110ms",
      context: "Kas Kecil",
      action: "Auto Jurnal",
      feed: 120,
      harvest: 1500,
      expense: 42180000
    }
  ], []);

  // Typewriter effect triggered when landingAiTab changes
  useEffect(() => {
    let currentIdx = 0;
    const targetText = aiVoiceSamples[landingAiTab]?.aiReply || '';
    setTypewriterText('');
    
    const interval = setInterval(() => {
      if (currentIdx < targetText.length) {
        setTypewriterText(targetText.slice(0, currentIdx + 1));
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 28);

    return () => clearInterval(interval);
  }, [landingAiTab, aiVoiceSamples]);

  // Callbacks for SentinelAgentPanel to update dashboard data in real-time!
  const handleAddTransactionFromAi = useCallback((tx: { type: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'INCOME'; amount: number; description: string }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newTxId = `tx-ai-${Date.now()}`;
    
    // 1. Update landing page interactive demo expense if it's an expense
    if (tx.type === 'EXPENSE' || tx.type === 'PURCHASE') {
      setDemoAiExpense((prev) => prev + tx.amount);
    } else if (tx.type === 'SALE' || tx.type === 'INCOME') {
      setDemoAiHarvest((prev) => prev + Math.round(tx.amount / 20000)); // estimate weight based on average fish price per kg
    }

    // 2. Add to real bookkeeping states
    const direction = (tx.type === 'SALE' || tx.type === 'INCOME') ? 'IN' : 'OUT';
    const newCashEntry = {
      id: `cash-ai-${Date.now()}`,
      date: todayStr,
      category: tx.type === 'SALE' || tx.type === 'INCOME' ? 'Pemasukan AI' : 'Biaya AI',
      amount: tx.amount,
      direction,
      account: 'CASH',
      description: tx.description,
    };

    setCashEntriesList((prev) => [newCashEntry, ...prev]);

    if (direction === 'OUT') {
      setExpensesList((prev) => [newCashEntry, ...prev]);
    } else {
      const newTx: TransactionRecord = {
        id: newTxId,
        sjNumber: `SJ-AI-${Math.floor(1000 + Math.random() * 9000)}`,
        date: todayStr,
        customerName: 'Pelanggan AI',
        type: 'SALE',
        itemName: tx.description,
        quantity: 1,
        unit: 'paket',
        unitPrice: tx.amount,
        totalPrice: tx.amount,
        paymentStatus: 'LUNAS',
        connectedSupplyChain: false,
        notes: 'Dicatat otomatis oleh Teman Catat Harian.',
      };
      setSalesTransactions((prev) => [newTx, ...prev]);
    }
  }, []);

  const handleUpdateFeedStockFromAi = useCallback((amountKg: number) => {
    // 1. Decrement interactive landing page demo feed
    setDemoAiFeed((prev) => Math.max(0, prev - Math.round(amountKg / 30))); // 1 sak = 30kg

    // 2. Decrement real products stock if any feed products exist
    setProducts((prev) =>
      prev.map((p) => {
        if (p.size.toLowerCase().includes('pakan') || p.size.toLowerCase().includes('pelet')) {
          return {
            ...p,
            stock: Math.max(0, p.stock - Math.round(amountKg / 30)),
          };
        }
        return p;
      })
    );
  }, []);

  const handleUpdatePondStatusFromAi = useCallback((kolamName: string, feedKg?: number, mortalityTail?: number, ph?: number, doValue?: number) => {
    // 1. Update matching pond/cycle status in the cycles state
    setCycles((prev) =>
      prev.map((c) => {
        if (c.pond.toLowerCase().includes(kolamName.toLowerCase()) || kolamName.toLowerCase().includes(c.pond.toLowerCase())) {
          const updatedSr = mortalityTail ? Math.max(0, c.sr - (mortalityTail / 100)) : c.sr;
          const updatedBiomass = feedKg ? c.biomass + (feedKg * 0.8) : c.biomass;
          return {
            ...c,
            sr: Number(updatedSr.toFixed(1)),
            biomass: Number(updatedBiomass.toFixed(1)),
          };
        }
        return c;
      })
    );
  }, []);

  // Auto-normalize workspaceModuleTab when entering platform view
  useEffect(() => {
    if (view === 'platform') {
      if (workspaceModuleTab === 'dashboard' || !PLATFORM_MODULES.some(m => m.id === workspaceModuleTab)) {
        setWorkspaceModuleTab('overview');
      }
    }
  }, [view, workspaceModuleTab]);

  // Service worker & PWA installation trigger
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setPwaPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsPwaInstalled(true);
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  // ALLOW DARK/LIGHT MODE FOR LANDING VIEW AND ALL DASHBOARD VIEWS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isThemedView = view === 'landing' || view === 'distributor' || view === 'budidaya' || view === 'platform';
      
      if (!isThemedView) {
        // Force light mode on Auth, Blueprint Select, etc.
        document.documentElement.classList.remove('dark');
      } else {
        // Respect saved theme or current state
        const s = localStorage.getItem('tumbu-theme') as Theme | null;
        const currentTheme = s || theme;
        document.documentElement.classList.toggle('dark', currentTheme === 'dark');
      }
    }
  }, [view, theme]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const toggleTheme = () => {
    const isThemedView = view === 'landing' || view === 'distributor' || view === 'budidaya' || view === 'platform';
    if (!isThemedView) return; // theme toggle only in themed views
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('tumbu-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    showToast(`Tema: ${next === 'dark' ? 'Dark mode' : 'Light mode'}`);
  };

  const triggerPwaInstall = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('Aplikasi TUMBU berhasil dipasang!');
          setIsPwaInstalled(true);
        }
        setPwaPrompt(null);
      });
    } else {
      setShowPwaModal(true);
    }
  };

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    setSolusiOpen(false);
    if (view !== 'landing') {
      setView('landing');
      setTimeout(() => {
        if (id === 'hero' || id === 'home') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      if (id === 'hero' || id === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const startAuth = (as: 'register' | 'login' = 'register') => {
    setAuthMode(as);
    setView('auth');
    setError(null);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const fetchWorkspaceMembers = async (workspaceId: string) => {
    if (!workspaceId) return;
    setLoadingMembers(true);
    try {
      const list = await serviceApi.listMembers(authToken!);

      if (list.length === 0) {
        const ownerEmail = currentUser?.email || 'owner@tumbu.id';
        const ownerName = currentUser?.name || 'Owner Utama';
        const initialOwner = {
          id: currentUser?.id || 'owner_initial',
          email: ownerEmail,
          name: ownerName,
          role: 'OWNER',
          status: 'ACTIVE',
          invitedAt: new Date().toISOString()
        };
        // const docRef = doc(db, 'workspaces', workspaceId, 'members', initialOwner.id);
        // await setDoc(docRef, initialOwner);
        list.push(initialOwner);
      }

      setWorkspaceMembers(list);
      localStorage.setItem(`tumbu-members-${workspaceId}`, JSON.stringify(list));
    } catch (err) {
      console.warn("Firestore offline or permission error, using local fallback:", err);
      const local = localStorage.getItem(`tumbu-members-${workspaceId}`);
      if (local) {
        setWorkspaceMembers(JSON.parse(local));
      } else {
        const ownerEmail = currentUser?.email || 'owner@tumbu.id';
        const ownerName = currentUser?.name || 'Owner Utama';
        const defaultList = [
          {
            id: currentUser?.id || 'owner_initial',
            email: ownerEmail,
            name: ownerName,
            role: 'OWNER',
            status: 'ACTIVE',
            invitedAt: new Date().toISOString()
          }
        ];
        setWorkspaceMembers(defaultList);
      }
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInviteMember = async () => {
    if (!activeWorkspace?.id) {
      showToast('Workspace tidak aktif');
      return;
    }
    if (!inviteEmailOrId.trim()) {
      showToast('Masukkan Email atau ID Anggota');
      return;
    }

    const validRoles = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER'];
    if (!validRoles.includes(inviteRole)) {
      showToast('Role tidak valid');
      return;
    }

    const emailOrId = inviteEmailOrId.trim();
    const newMemberId = 'member_' + Math.random().toString(36).substr(2, 9);

    const newMember = {
      id: newMemberId,
      email: emailOrId.includes('@') ? emailOrId : '',
      memberId: !emailOrId.includes('@') ? emailOrId : '',
      name: emailOrId.split('@')[0],
      role: inviteRole,
      status: 'INVITED',
      invitedAt: new Date().toISOString()
    };

    try {
      // const docRef = doc(db, 'workspaces', activeWorkspace.id, 'members', newMemberId);
      // await setDoc(docRef, newMember);
      await fetchWorkspaceMembers(activeWorkspace.id);
      showToast(`Berhasil mengundang ${emailOrId} sebagai ${inviteRole}`);
      setInviteEmailOrId('');
    } catch (err) {
      console.warn("Firestore save failed, saving locally:", err);
      const updatedList = [...workspaceMembers, newMember];
      setWorkspaceMembers(updatedList);
      localStorage.setItem(`tumbu-members-${activeWorkspace.id}`, JSON.stringify(updatedList));
      showToast(`[Offline-Mode] Berhasil menyimpan undangan ${emailOrId} secara lokal`);
      setInviteEmailOrId('');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace?.id) return;

    try {
      // const docRef = doc(db, 'workspaces', activeWorkspace.id, 'members', memberId);
      // await deleteDoc(docRef);
      await fetchWorkspaceMembers(activeWorkspace.id);
      showToast('Anggota berhasil dihapus dari workspace');
    } catch (err) {
      console.warn("Firestore delete failed, removing locally:", err);
      const updatedList = workspaceMembers.filter(m => m.id !== memberId);
      setWorkspaceMembers(updatedList);
      localStorage.setItem(`tumbu-members-${activeWorkspace.id}`, JSON.stringify(updatedList));
      showToast('[Offline-Mode] Anggota berhasil dihapus secara lokal');
    }
  };

  const routeToWorkspace = (workspace: any) => {
    if (!workspace?.id) {
      setView('blueprintSelect');
      return;
    }

    // Ensure jenisUsaha is inferred from blueprint if missing
    if (!workspace.jenisUsaha) {
      const blueprintId = String(workspace.blueprintId || '').toLowerCase();
      workspace.jenisUsaha = blueprintId === BLUEPRINT_IDS.budidaya ? 'budidaya' : 'distributor';
    }

    if (!workspace.jenisUsaha) {
      setActiveWorkspace(workspace);
      setView('setup');
      return;
    }

    // Reset data states when entering workspace to load clean user data
    setProducts([]);
    setCycles([]);
    setSalesTransactions([]);
    setExpensesList([]);
    setCashEntriesList([]);
    setReceiptsList([]);

    setActiveWorkspace(workspace);
    setWorkspaceName(workspace.name || 'Usaha Saya');
    setWorkspaceStatus(workspace.status || null);
    localStorage.setItem('tumbu-active-workspace', JSON.stringify(workspace));
    localStorage.setItem('tumbu_active_workspace', JSON.stringify(workspace));

    void fetchWorkspaceMembers(workspace.id);

    const blueprintId = String(workspace.blueprintId || '').toLowerCase();
    if (blueprintId === BLUEPRINT_IDS.budidaya) {
      setView('budidaya');
    } else {
      setView('distributor');
    }
  };

  const activateWorkspace = async (workspace: any, tokenOverride?: string) => {
    const token = tokenOverride || authToken;
    if (!token || !workspace?.id) return;
    const context = await platformApi.activateWorkspace(token, workspace.id);
    setWorkspaceContext(context || null);
    const resolved = {
      ...(workspace || {}),
      ...(context?.workspace || {}),
      blueprintId: context?.blueprint?.id || workspace.blueprintId,
    };
    setWorkspaces((prev) => prev.map((row) => row.id === resolved.id ? { ...row, ...resolved } : row));
    routeToWorkspace(resolved);
  };

  const handleUpdateWorkspaceStatus = async (id: string, status: string) => {
    try {
      if (authToken) {
        if (status === 'ACTIVE') await platformApi.approveWorkspace(authToken, id);
        else await platformApi.rejectWorkspace(authToken, id);
      }
      setPlatformWorkspacesList(prev => prev.map(w => w.id === id ? { ...w, status } : w));
      showToast(`Status workspace berhasil diubah ke ${status}`);
    } catch {
      showToast('Gagal memperbarui status workspace');
    }
  };

  const handleLogin = async (overrideEmail?: string, overridePassword?: string) => {
    const email = (overrideEmail || authEmail).trim().toLowerCase();
    const password = overridePassword || authPassword;
    if (!email || !password) {
      showToast('Email dan password wajib diisi');
      return;
    }

    setAuthLoading(true);
    setError(null);
    try {
      const result = await authApi.login(email, password);
      if (!result?.token) throw new Error('Login berhasil tetapi token tidak diterima.');

      localStorage.setItem('tumbu-token', result.token);
      if (result.user) localStorage.setItem('tumbu-user', JSON.stringify(result.user));
      if (Array.isArray(result.workspaces)) localStorage.setItem('tumbu-workspaces', JSON.stringify(result.workspaces));

      setAuthToken(result.token);
      setCurrentUser(result.user || null);
      setWorkspaces(Array.isArray(result.workspaces) ? result.workspaces : []);

      if (result.land === 'platform' || result.user?.isPlatformAdmin) {
        setView('platform');
        showToast('Berhasil masuk Platform Admin');
        return;
      }

      const enterable = (result.workspaces || []).filter((w: any) =>
        w.status === 'ACTIVE' || w.status === 'GRACE' ||
        (w.isActive && w.status !== 'SUSPENDED' && w.status !== 'PENDING' && w.status !== 'REJECTED')
      );

      if (enterable.length >= 1) {
        await activateWorkspace(enterable[0], result.token);
        showToast('Berhasil masuk Dashboard Usaha!');
        return;
      }

      setView('distributor');
      showToast('Selamat datang!');
    } catch (e: any) {
      const message = e?.message || 'Login gagal. Silakan coba lagi.';
      setError(message);
      showToast(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    const name = authName.trim();
    const email = authEmail.trim().toLowerCase();
    if (!name || !email || !authPassword) {
      showToast('Nama, email, dan password wajib diisi');
      return;
    }

    if (authPassword !== authConfirmPassword) {
      setError('Konfirmasi password tidak cocok dengan password yang dimasukkan');
      showToast('Konfirmasi password tidak cocok');
      return;
    }

    if (!authAgreedTerms) {
      setError('Harap setujui Ketentuan Layanan & Kebijakan Privasi Platform TUMBU');
      showToast('Harap centang persetujuan platform');
      return;
    }

    setAuthLoading(true);
    setError(null);
    try {
      const result = await authApi.register(name, email, authPassword);
      if (!result?.token) throw new Error('Registrasi berhasil tetapi token tidak diterima.');

      localStorage.setItem('tumbu-token', result.token);
      if (result.user) localStorage.setItem('tumbu-user', JSON.stringify(result.user));
      if (Array.isArray(result.workspaces)) localStorage.setItem('tumbu-workspaces', JSON.stringify(result.workspaces));

      setAuthToken(result.token);
      setCurrentUser(result.user || null);
      setWorkspaces(Array.isArray(result.workspaces) ? result.workspaces : []);
      
      // Clean slate initialization for newly registered users
      setProducts([]);
      setCycles([]);
      setSalesTransactions([]);
      setPurchasesList([]);
      setBeritaAcaraList([]);
      setSuratJalanList([]);
      setExpensesList([]);
      setCashEntriesList([]);
      setReceiptsList([]);

      setOnboardingStep(1);
      setView('blueprintSelect');
      showToast('Akun berhasil dibuat — pilih blueprint');
    } catch (e: any) {
      const message = e?.message || 'Registrasi gagal. Silakan coba lagi.';
      setError(message);
      showToast(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) await authApi.logout(authToken);
    } catch { /* clear local session */ }
    localStorage.removeItem('tumbu-token');
    localStorage.removeItem('tumbu-user');
    localStorage.removeItem('tumbu-workspaces');
    localStorage.removeItem('tumbu-active-workspace');
    setAuthToken(null);
    setCurrentUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setWorkspaceContext(null);
    
    // Automatic return to Light Mode on Logout!
    setTheme('light');
    localStorage.setItem('tumbu-theme', 'light');
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }

    setView('landing');
    showToast('Berhasil keluar');
  };

  // Restore session on reload
  useEffect(() => {
    let cancelled = false;
    const activateWorkspaceWithToken = async (token: string, workspace: any) => {
      const context = await platformApi.activateWorkspace(token, workspace.id);
      setWorkspaceContext(context || null);
      if (cancelled) return;
      const resolved = { ...workspace, ...(context?.workspace || {}), blueprintId: context?.blueprint?.id || workspace.blueprintId };
      setActiveWorkspace(resolved);
      setWorkspaceName(resolved.name || '');
      setWorkspaceStatus(resolved.status || null);
      localStorage.setItem('tumbu-active-workspace', JSON.stringify(resolved));
      localStorage.setItem('tumbu_active_workspace', JSON.stringify(resolved));
      if (resolved.blueprintId === BLUEPRINT_IDS.budidaya) setView('budidaya');
      else setView('distributor');
    };

    const restoreSession = async () => {
      const token = localStorage.getItem('tumbu-token') || localStorage.getItem('tumbu_token');
      if (!token) return;
      try {
        const result = await authApi.me(token);
        if (cancelled) return;

        localStorage.setItem('tumbu-token', token);
        localStorage.setItem('tumbu_token', token);

        setAuthToken(token);
        setCurrentUser(result.user || null);
        setWorkspaces(Array.isArray(result.workspaces) ? result.workspaces : []);

        if (result.user?.isPlatformAdmin) {
          setView('platform');
          return;
        }

        const storedActive = localStorage.getItem('tumbu-active-workspace') || localStorage.getItem('tumbu_active_workspace');
        if (storedActive) {
          try {
            const workspace = JSON.parse(storedActive);
            await activateWorkspaceWithToken(token, workspace);
            return;
          } catch {
            // fall through to workspace auto-select
          }
        }

        const enterable = (result.workspaces || []).filter((w: any) =>
          w.status === 'ACTIVE' || w.status === 'GRACE' ||
          (w.isActive && w.status !== 'SUSPENDED' && w.status !== 'PENDING' && w.status !== 'REJECTED')
        );

        if (enterable.length >= 1) {
          await activateWorkspaceWithToken(token, enterable[0]);
          return;
        }

        setView('distributor');
      } catch {
        if (cancelled) return;
        localStorage.removeItem('tumbu-token');
        localStorage.removeItem('tumbu_token');
        localStorage.removeItem('tumbu-user');
        localStorage.removeItem('tumbu-workspaces');
        localStorage.removeItem('tumbu-active-workspace');
        localStorage.removeItem('tumbu_active_workspace');
        setAuthToken(null);
        setView('landing');
      }
    };

    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Fetch live data for active workspace
  useEffect(() => {
    if (!authToken || (view !== 'distributor' && view !== 'budidaya')) {
      setProducts([]);
      setCycles([]);
      setLoadingProducts(false);
      setLoadingCycles(false);
      return;
    }

    const controller = new AbortController();
    setLoadingProducts(true);
    setLoadingCycles(true);

    const fetchProducts = async () => {
      try {
        const data = await erpApi.products(authToken);
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const mapped: Product[] = rows.map((p: any) => ({
          size: p.name || p.size || 'Uncategorized',
          stock: parseDecimal(p.stock),
          price: parseDecimal(p.price),
          sold: parseDecimal(p.sold ?? 0),
          unit: p.unit ?? 'ekor',
          commodityCategory: p.commodityCategory ?? 'Benih',
        }));
        setProducts(mapped);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Gagal memuat produk');
      } finally {
        if (!controller.signal.aborted) setLoadingProducts(false);
      }
    };

    const fetchCycles = async () => {
      try {
        const data = await cycleApi.list(authToken, budidayaStateFilter === 'ALL' ? {} : { state: budidayaStateFilter });
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const mapped: Cycle[] = rows.map((c: any) => ({
          id: c.id,
          pond: c.pondName || c.pond || 'Kolam',
          doc: parseDecimal(c.doc),
          sr: parseDecimal(c.srPct ?? c.sr),
          abw: parseDecimal(c.abw),
          biomass: parseDecimal(c.biomass),
          state: c.state || 'GROWING',
        }));
        setCycles(mapped);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Gagal memuat siklus');
      } finally {
        if (!controller.signal.aborted) setLoadingCycles(false);
      }
    };

    const fetchTransactions = async () => {
      try {
        const data = await erpApi.transactions(authToken);
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const mapped: TransactionRecord[] = rows.map((t: any) => ({
          id: String(t.id || `tx_${Math.random()}`),
          sjNumber: t.sjNumber || t.number || (t.id ? `SJ-${String(t.id).slice(0, 6)}` : 'SJ-000000'),
          date: t.date ? String(t.date).split('T')[0] : new Date().toISOString().split('T')[0],
          customerName: t.customerName || t.partnerName || t.partner?.name || 'Pelanggan',
          type: t.type || 'SALE',
          itemName: t.itemName || t.items?.[0]?.productName || 'Benih Ikan',
          quantity: parseDecimal(t.quantity || t.items?.[0]?.quantity || 0),
          unit: t.unit || t.items?.[0]?.unit || 'ekor',
          unitPrice: parseDecimal(t.unitPrice || t.items?.[0]?.price || 0),
          totalPrice: parseDecimal(t.totalPrice || t.amount || 0),
          paymentStatus: t.paymentStatus || (t.status === 'PAID' ? 'LUNAS' : 'TEMPO'),
          dueDate: t.dueDate,
          connectedSupplyChain: Boolean(t.connectedSupplyChain || t.pondDestination),
          pondDestination: t.pondDestination,
          notes: t.notes || '',
        }));
        if (mapped.length > 0) {
          setSalesTransactions(mapped);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('Gagal memuat transaksi sales', e);
      }
    };

    const fetchCash = async () => {
      try {
        const data = await erpApi.cash(authToken);
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const mappedCash = rows.map((c: any) => ({
          id: c.id,
          date: c.date ? c.date.split('T')[0] : new Date().toISOString().split('T')[0],
          category: c.category || 'Mutasi Kas',
          amount: parseDecimal(c.amount),
          direction: c.direction || 'IN',
          account: c.account || 'CASH',
          description: c.description || c.notes || '',
        }));
        setCashEntriesList(mappedCash);

        // Filter OUT entries or expenses categories
        const expenses = mappedCash.filter((c: any) => c.direction === 'OUT');
        setExpensesList(expenses);

        // Build kwitansi/receipts from IN entries
        const receipts = mappedCash
          .filter((c: any) => c.direction === 'IN')
          .map((c: any, idx: number) => ({
            id: `kw-${c.id}`,
            receiptNo: `KW-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`,
            date: c.date,
            payerName: c.description ? (c.description.includes('Pak') || c.description.includes('PT') ? c.description : 'Pelanggan') : 'Pelanggan',
            amount: c.amount,
            description: c.description || c.category,
            paymentMethod: c.account === 'CASH' ? 'TUNAI / KAS' : 'TRANSFER BANK BCA',
          }));
        setReceiptsList(receipts);
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('Gagal memuat mutasi kas', e);
      }
    };

    void fetchProducts();
    void fetchCycles();
    void fetchTransactions();
    void fetchCash();

    return () => controller.abort();
  }, [authToken, view, budidayaStateFilter]);

  // Fetch Platform Admin live metrics
  useEffect(() => {
    if (view === 'platform' && authToken) {
      setPlatformLoading(true);
      Promise.all([
        platformApi.overview(authToken).catch(() => null),
        platformApi.workspaces(authToken).catch(() => []),
      ]).then(([overviewData, workspacesData]) => {
        if (overviewData) setPlatformOverview(overviewData);
        const rows = Array.isArray(workspacesData) ? workspacesData : (Array.isArray(workspacesData?.items) ? workspacesData.items : []);
        setPlatformWorkspacesList(rows);
      }).finally(() => {
        setPlatformLoading(false);
      });
    }
  }, [view, authToken]);

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductStock) {
      showToast('Nama produk dan jumlah stok wajib diisi');
      return;
    }
    setAddingProduct(true);
    try {
      if (authToken) {
        await erpApi.createProduct(authToken, {
          name: newProductName.trim(),
          stock: Number(newProductStock),
          price: Number(newProductPrice) || 0,
          unit: newProductName.includes('Pelet') ? 'sak' : 'ekor',
        });
      }
      showToast('Produk berhasil ditambahkan!');
      setNewProductName('');
      setNewProductStock('');
      setNewProductPrice('');
      if (authToken) {
        const updated = await erpApi.products(authToken);
        const mapped: Product[] = (Array.isArray(updated) ? updated : []).map((p: any) => ({
          size: p.name || p.size,
          stock: parseDecimal(p.stock),
          price: parseDecimal(p.price),
          sold: 0,
          unit: p.unit || 'ekor',
          commodityCategory: p.commodityCategory || 'Benih',
        }));
        setProducts(mapped);
      }
    } catch {
      showToast('Gagal menambah produk');
    } finally {
      setAddingProduct(false);
    }
  };

  const activeModules = view === 'platform' ? PLATFORM_MODULES : getModulesForBusiness(activeWorkspace?.jenisUsaha);

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden font-[Satoshi] antialiased selection:bg-[#F8BF24]/30"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'Satoshi, system-ui, sans-serif'
      }}
    >
      {/* Global CSS Styles */}

      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --bg: #F7FEF9;
          --card: #FFFFFF;
          --card-2: #EDF7F1;
          --text: #0F172A;
          --text-muted: #475569;
          --text-faint: #64748B;
          --border: #E2EAF0;
          --border-strong: #CBD5E1;
          --shadow-d: #CBD5E1;
          --shadow-l: #FFFFFF;
          --nav-bg: rgba(247,254,249,0.92);
          --shadow-size: 8px;
          --shadow-blur: 18px;
          --primary: #0F172A;
          --teal: #1DBAB0;
          --green: #2BBF78;
          --gold: #F2C900;
        }
        .dark {
          --bg: #0F172A;
          --card: #1B2742;
          --card-2: #162035;
          --text: #E6E9F2;
          --text-muted: #94A3B8;
          --text-faint: #64748B;
          --border: #25324A;
          --border-strong: #334155;
          --shadow-d: #0B1220;
          --shadow-l: #162032;
          --nav-bg: rgba(15,23,42,0.92);
          --shadow-size: 8px;
          --shadow-blur: 16px;
        }
        * { border-color: var(--border); box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        h1,h2,h3,.display { font-family: Satoshi, system-ui, sans-serif; letter-spacing: -0.025em; }
        .clay {
          background: var(--card);
          box-shadow: 0 4px 16px rgba(15,23,42,0.04);
          border: 1px solid var(--border);
        }
        .clay-inset {
          background: var(--bg);
          box-shadow: inset 2px 2px 6px rgba(0,0,0,0.05);
        }
        .glass {
          background: var(--nav-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .glass-login {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.08);
        }
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(64px);
          pointer-events: none;
          opacity: 0.18;
          max-width: 80vw;
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; }
      `}} />

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] text-[13px] font-semibold shadow-2xl border border-white/10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />{toast}
        </div>
      )}

      {/* PWA MOBILE INSTALL INSTRUCTION MODAL */}
      {showPwaModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] bg-white text-[#0F172A] rounded-[24px] p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowPwaModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[16px]">Pasang TUMBU OS di HP</h3>
                <p className="text-[12px] text-slate-500">Akses instan & mode offline</p>
              </div>
            </div>
            <div className="space-y-2.5 text-[13px] text-slate-700 bg-slate-50 p-3.5 rounded-[16px] border border-slate-200">
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#0EA5E9] text-[14px]">1.</span>
                <span>Buka website ini melalui browser HP (Chrome / Safari).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#0EA5E9] text-[14px]">2.</span>
                <span>Tekan tombol menu browser (titik 3 di Chrome atau icon Share di Safari).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#0EA5E9] text-[14px]">3.</span>
                <span>Pilih <strong className="text-black font-bold">"Tambah ke Layar Utama"</strong> atau <strong className="text-black font-bold">"Instal Aplikasi"</strong>.</span>
              </div>
            </div>
            <button
              onClick={() => setShowPwaModal(false)}
              className="w-full h-11 rounded-full bg-[#0F172A] text-white font-semibold text-[13px]"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL TOP NAVBAR (Only for Landing / Blueprint / Setup / Integrasi - HIDDEN ON LOGIN/AUTH) */}
      {(view === 'landing' || view === 'blueprintSelect' || view === 'setup' || view === 'workspaceSelect' || view === 'integrasi') && (
        <header className="sticky top-0 z-[50] bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between">
            <button
              onClick={() => scrollTo('hero')}
              className="appearance-none !bg-transparent border-0 flex items-center gap-2.5 group shrink-0 cursor-pointer"
              aria-label="TUMBU OS home"
            >
              <img src={logoIconUrl} alt="TUMBU" className="w-8 h-8 object-contain" />
              <div className="flex flex-col text-left">
                <span className="display font-bold text-[18px] tracking-tight text-[var(--text)] leading-none">TUMBU</span>
                <span className="text-[10px] text-[#0EA5E9] font-semibold tracking-wider uppercase mt-0.5">Offline-First OS</span>
              </div>
            </button>

            {view === 'landing' && (
              <nav className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-[var(--text)]">
                <button onClick={() => scrollTo('hero')} className="appearance-none !bg-transparent border-0 py-2 transition-colors hover:text-[#0EA5E9] cursor-pointer">Beranda</button>
                <button onClick={() => scrollTo('offline-pwa')} className="appearance-none !bg-transparent border-0 py-2 transition-colors hover:text-[#0EA5E9] flex items-center gap-1 cursor-pointer">
                  <WifiOff className="w-3.5 h-3.5 text-[#22C55E]" /> Offline & PWA
                </button>
                <div className="relative">
                  <button onClick={() => setSolusiOpen(o => !o)} className="appearance-none !bg-transparent border-0 py-2 transition-colors hover:text-[#0EA5E9] flex items-center gap-1.5 cursor-pointer">
                    Solusi Usaha <ChevronDown className={`w-4 h-4 transition ${solusiOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {solusiOpen && (
                    <div className="absolute top-[44px] left-0 w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-[18px] p-2 z-[100]">
                      <button onClick={() => { scrollTo('distributor-sec'); setSolusiOpen(false); }} className="w-full text-left flex gap-3 p-3 rounded-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                        <div className="w-9 h-9 rounded-[10px] bg-[#0EA5E9]/10 flex items-center justify-center text-[#0EA5E9]"><Store className="w-5 h-5" /></div>
                        <div><div className="font-bold text-[14px] text-slate-900 dark:text-white">Distributor Benih</div><div className="text-[12px] text-slate-500">Stok per cm, SJ, piutang, kas</div></div>
                      </button>
                      <button onClick={() => { scrollTo('budidaya-sec'); setSolusiOpen(false); }} className="w-full text-left flex gap-3 p-3 rounded-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                        <div className="w-9 h-9 rounded-[10px] bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]"><Waves className="w-5 h-5" /></div>
                        <div><div className="font-bold text-[14px] text-slate-900 dark:text-white">Pembudidaya</div><div className="text-[12px] text-slate-500">Kolam, DOC, feeding, panen</div></div>
                      </button>
                      <button onClick={() => { scrollTo('integrasi'); setShowHuluHilirModal(true); setSolusiOpen(false); }} className="w-full text-left flex gap-3 p-3 rounded-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                        <div className="w-9 h-9 rounded-[10px] bg-[#F8BF24]/10 flex items-center justify-center text-[#F8BF24]"><Link2 className="w-5 h-5" /></div>
                        <div><div className="font-bold text-[14px] text-slate-900 dark:text-white flex items-center gap-1.5">Kemitraan Terintegrasi <Sparkles className="w-3.5 h-3.5 text-[#F8BF24]" /></div><div className="text-[12px] text-slate-500">Rantai pasok hulu-hilir</div></div>
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => scrollTo('pricing')} className="appearance-none !bg-transparent border-0 py-2 transition-colors hover:text-[#0EA5E9] cursor-pointer">Harga</button>
              </nav>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              {view === 'landing' ? (
                <>
                  <button
                    onClick={toggleTheme}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[var(--border-strong)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--bg)] transition-all flex items-center justify-center cursor-pointer p-0 shrink-0"
                    title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4 text-slate-600" /> : <Sun className="w-4 h-4 text-[#F2C900]" />}
                  </button>
                  <button onClick={() => startAuth('login')} className="appearance-none border border-[var(--border-strong)] bg-[var(--card)] hover:bg-[var(--bg)] text-[13px] sm:text-[14px] font-semibold h-9 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center transition-all cursor-pointer">
                    Masuk
                  </button>
                  {/* Button "Daftar Gratis" ONLY shown on desktop screens (hidden on mobile) */}
                  <button onClick={() => startAuth('register')} className="hidden lg:inline-flex h-10 px-5 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] text-[14px] font-semibold items-center justify-center gap-1.5 shadow-md dark:shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:opacity-90 transition-all cursor-pointer">
                    Daftar Gratis <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => scrollTo('hero')}
                  className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-all flex items-center justify-center cursor-pointer p-0 bg-transparent"
                  title="Kembali ke Beranda"
                >
                  <Home className="w-5 h-5" />
                </button>
              )}

              {/* Hamburger Button for Mobile */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="lg:hidden w-10 h-10 rounded-full clay flex items-center justify-center cursor-pointer shrink-0 border border-[var(--border)]"
                aria-label="Toggle Menu"
              >
                {mobileOpen ? <X className="w-5 h-5 text-[var(--text)]" /> : <Menu className="w-5 h-5 text-[var(--text)]" />}
              </button>
            </div>
          </div>

          {/* MOBILE SLIDE-DOWN DRAWER MENU (Rich Mobile Menu Content) */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden bg-[var(--card)] border-b border-[var(--border)] shadow-xl overflow-hidden"
              >
                <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
                  <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={logoIconUrl} alt="TUMBU" className="w-6 h-6 object-contain" />
                      <span className="font-bold text-[15px]">TUMBU OS</span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] font-semibold">Offline-First</span>
                  </div>

                  <button onClick={() => scrollTo('hero')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#0EA5E9]" /> Beranda
                  </button>
                  <button onClick={() => scrollTo('offline-pwa')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-[#22C55E]" /> Fitur Offline & Sinyal Jelek
                  </button>
                  <button onClick={() => scrollTo('distributor-sec')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#0EA5E9]" /> Solusi Distributor Benih
                  </button>
                  <button onClick={() => scrollTo('budidaya-sec')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <Waves className="w-4 h-4 text-[#22C55E]" /> Solusi Pembudidaya Air Tawar
                  </button>
                  <button onClick={() => scrollTo('integrasi')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F8BF24]" /> Kemitraan Terintegrasi
                  </button>
                  <button onClick={() => scrollTo('pricing')} className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--bg)] font-medium text-[14px] flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#0EA5E9]" /> Paket & Harga
                  </button>

                  <div className="pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2">
                    <button onClick={() => startAuth('login')} className="w-full h-11 rounded-xl clay font-semibold text-[13px] flex items-center justify-center">
                      Masuk
                    </button>
                    <button onClick={() => startAuth('register')} className="w-full h-11 rounded-xl bg-[#0F172A] text-white font-semibold text-[13px] flex items-center justify-center gap-1">
                      Daftar Gratis <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      {/* MAIN CONTENT LANDING */}
      {view === 'landing' && (
        <main className="relative overflow-hidden bg-[var(--bg)] min-h-screen text-[var(--text)]">
          {/* Decorative blur elements */}
          <div className="absolute w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl -top-20 -right-20 pointer-events-none" />
          <div className="absolute w-[600px] h-[600px] rounded-full bg-teal-500/10 dark:bg-teal-500/5 blur-3xl top-1/3 -left-20 pointer-events-none" />

          {/* HERO SECTION */}
          <section id="hero" className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-14 lg:pb-20">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Column: Value Proposition & Social Proof */}
              <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-left">
                {/* Refined Eyebrow Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] sm:text-[12px] font-bold bg-[#2BBF78]/10 text-[#2BBF78] dark:bg-[#2BBF78]/15 dark:text-[#2BBF78] border border-[#2BBF78]/25 tracking-wide shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#2BBF78] animate-pulse" />
                  <span>SISTEM OPERASI BUDIDAYA & DISTRIBUSI IKAN #1</span>
                </div>

                {/* Engaging, High-Impact Main Headline */}
                <h1 className="display text-[32px] sm:text-[44px] lg:text-[54px] font-[900] leading-[1.1] tracking-[-0.03em] text-[var(--text)]">
                  Usaha Tambak Tumbuh Pesat, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4]">
                    Tinggalkan Catatan Manual.
                  </span>
                </h1>

                {/* Value Proposition Description */}
                <p className="text-[15px] sm:text-[16px] leading-[1.65] text-[var(--text-muted)] max-w-[560px]">
                  TUMBU OS mengintegrasikan pencatatan pakan harian, kontrol kualitas air, kalkulasi FCR & biomassa otomatis, hingga surat jalan sortir benih per cm dan laporan laba rugi riil. Tetap bekerja 100% lancar di tengah kolam walau tanpa sinyal internet.
                </p>

                {/* Credible Aquaculture Owner Testimonial Card */}
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm max-w-[560px] flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2BBF78] to-[#1DBAB0] text-slate-950 font-black flex items-center justify-center text-[13px] shrink-0 shadow-xs">
                    HB
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-[13px] italic text-[var(--text)] leading-relaxed">
                      "Dulu bon sobek sering basah atau hilang, hitung laba tiap siklus cuma tebak-tebakan. Sejak pakai TUMBU, input di pinggir kolam langsung sinkron jadi laporan keuangan rapi."
                    </p>
                    <div className="text-[11px] font-bold text-[#1DBAB0]">
                      — H. Bambang Subagyo <span className="font-normal text-[var(--text-muted)]">• Distributor Benih & 24 Kolam Bioflok, Boyolali</span>
                    </div>
                  </div>
                </div>

                {/* Action CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    onClick={() => startAuth('register')}
                    className="h-12 px-7 rounded-full bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4] text-white font-bold text-[14px] shadow-lg shadow-emerald-500/20 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border-0"
                  >
                    Daftar Usaha Gratis <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startAuth('login')}
                    className="h-12 px-6 rounded-full border border-[var(--border-strong)] bg-[var(--card)] hover:bg-[var(--bg)] text-[var(--text)] font-semibold text-[14px] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Users className="w-4 h-4 text-[#1DBAB0]" /> Masuk ke Akun
                  </button>
                </div>

                {/* Trust & Key Features Badges */}
                <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-[560px] text-[12px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> Buka Instan &lt;1s (PWA 1.8MB)
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> 100% Offline di Kolam
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> Sortir Benih per CM
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> Hitung FCR & HPP Otomatis
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> Surat Jalan & BA 1-Klik
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-[#2BBF78] shrink-0" /> Multi-User & Izin Tim
                  </div>
                </div>
              </div>

              {/* Right Column: Clean Smartphone Mockup (No protruding lines, perfectly contained) */}
              <div className="lg:col-span-5 relative flex justify-center items-center w-full py-4 lg:py-0">
                {/* Floating Interactive Badge: Top Left */}
                <div className="hidden xl:flex absolute -left-6 top-8 z-20 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white shadow-xl items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">
                    ⚡
                  </div>
                  <div>
                    <div className="text-[10px] font-bold leading-tight">Instant Load &lt;1s</div>
                    <div className="text-[8px] text-slate-400">PWA Ringan 1.8MB</div>
                  </div>
                </div>

                {/* Floating Interactive Badge: Bottom Right */}
                <div className="hidden xl:flex absolute -right-4 bottom-14 z-20 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 text-white shadow-xl items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <div>
                    <div className="text-[10px] font-bold leading-tight text-emerald-300">Auto-Sync Cloud</div>
                    <div className="text-[8px] text-slate-400">Otomatis saat ada sinyal</div>
                  </div>
                </div>

                {/* Smartphone Chassis - Clean, curved, no sticking lines */}
                <div className="relative w-[285px] sm:w-[305px] h-[585px] sm:h-[610px] bg-gradient-to-b from-slate-700 via-slate-850 to-slate-950 p-[9px] rounded-[46px] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.55),0_0_30px_rgba(43,191,120,0.15)] ring-1 ring-white/20 animate-float-phone text-white select-none flex flex-col justify-between shrink-0">
                  {/* Inner Screen Bezel & Display */}
                  <div className="relative w-full h-full bg-[#080D1A] rounded-[38px] p-3 border border-slate-800/90 flex flex-col justify-between overflow-hidden shadow-inner">
                    {/* Top Dynamic Island */}
                    <div className="relative z-10 mb-1.5">
                      <div className="w-22 h-4.5 bg-black rounded-full mx-auto flex items-center justify-between px-2.5 shadow-md border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-blue-950" />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                    </div>

                    {/* Mobile Status Bar */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mb-1.5">
                      <span className="font-bold text-white tracking-tight text-[11px]">09:41</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/20">
                          OFFLINE
                        </span>
                        <WifiOff className="w-3 h-3 text-amber-400" />
                        <div className="w-3.5 h-2 rounded-2xs border border-slate-400 p-0.5 flex items-center">
                          <div className="w-full h-full bg-emerald-400 rounded-3xs" />
                        </div>
                      </div>
                    </div>

                    {/* Smartphone Screen Content: Full Aquaculture Operating UI */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                      {/* Mobile App Header */}
                      <div className="bg-slate-900/95 rounded-xl p-2 border border-slate-800 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                          <img src={logoIconUrl} alt="TUMBU" className="w-6 h-6 shrink-0 object-contain" />
                          <div className="text-left">
                            <div className="font-extrabold text-[11px] text-white leading-tight flex items-center gap-1">
                              TUMBU OS <span className="text-[7px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">PWA</span>
                            </div>
                            <div className="text-[8px] text-slate-400">Tambak Mina Makmur • Kolam A3</div>
                          </div>
                        </div>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Live
                        </span>
                      </div>

                      {/* 4 Essential Aquaculture KPIs in Mobile Screen */}
                      <div className="grid grid-cols-2 gap-1.5 text-left">
                        <div className="bg-slate-900/85 p-2 rounded-xl border border-slate-800">
                          <div className="text-[8px] text-slate-400 font-semibold uppercase">Biomassa Kolam</div>
                          <div className="text-[12px] font-black text-emerald-400 leading-tight mt-0.5">8.450 kg</div>
                          <div className="text-[8px] text-slate-400 mt-0.5">DOC 48 • SR 94%</div>
                        </div>
                        <div className="bg-slate-900/85 p-2 rounded-xl border border-slate-800">
                          <div className="text-[8px] text-slate-400 font-semibold uppercase">Pakan Hari Ini</div>
                          <div className="text-[12px] font-black text-sky-400 leading-tight mt-0.5">65 kg</div>
                          <div className="text-[8px] text-emerald-400 mt-0.5">FCR 1.08 • Hemat 18%</div>
                        </div>
                        <div className="bg-slate-900/85 p-2 rounded-xl border border-slate-800">
                          <div className="text-[8px] text-slate-400 font-semibold uppercase">Kualitas Air</div>
                          <div className="text-[11px] font-black text-amber-300 leading-tight mt-0.5">pH 7.4 • DO 5.8</div>
                          <div className="text-[8px] text-slate-400 mt-0.5">Suhu 28.2°C Optimal</div>
                        </div>
                        <div className="bg-slate-900/85 p-2 rounded-xl border border-slate-800">
                          <div className="text-[8px] text-slate-400 font-semibold uppercase">Est. Omzet Panen</div>
                          <div className="text-[11px] font-black text-white leading-tight mt-0.5">Rp 185,9 Juta</div>
                          <div className="text-[8px] text-emerald-400 mt-0.5">Margin 34%</div>
                        </div>
                      </div>

                      {/* Offline Queue & Activity Feed */}
                      <div className="bg-slate-900/95 rounded-xl p-2 border border-slate-800 space-y-1.5 text-left">
                        <div className="flex items-center justify-between text-[9px] px-0.5">
                          <span className="font-bold text-slate-300 flex items-center gap-1">
                            <Database className="w-3 h-3 text-[#2BBF78]" /> ANTREAN LAPANGAN
                          </span>
                          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-black text-[8px]">
                            3 Tersimpan
                          </span>
                        </div>

                        <div className="space-y-1 text-[8.5px]">
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                            <span className="text-slate-200 truncate max-w-[125px]">🐟 Panen Lele #A3 (520kg)</span>
                            <span className="text-[7.5px] text-amber-400 font-mono font-bold">[Antrean Lokal]</span>
                          </div>
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/80 border border-emerald-500/40">
                            <span className="text-slate-200 truncate max-w-[125px]">🌾 Pakan Turbo B2 (2 Sak)</span>
                            <span className="text-[7.5px] text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                              <RefreshCw className="w-2 h-2 animate-spin text-emerald-400" /> [Sinkron...]
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                            <span className="text-slate-200 truncate max-w-[125px]">📑 Surat Jalan #SJ-089</span>
                            <span className="text-[7.5px] text-sky-400 font-mono font-bold">[Tersimpan]</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Button inside Smartphone */}
                      <button
                        type="button"
                        onClick={() => {
                          setPwaToastMsg("✓ Tersimpan di memori HP! Data siap disinkronkan saat ada sinyal.");
                          setTimeout(() => setPwaToastMsg(null), 4000);
                        }}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-[#2BBF78] to-[#1DBAB0] text-[#0F172A] font-black text-[10.5px] shadow-md flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer border-0"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#0F172A]" /> + CATAT CEPAT DI KOLAM
                      </button>

                      {/* Native Mobile Bottom Navigation Bar */}
                      <div className="pt-1 border-t border-slate-800/80 grid grid-cols-4 gap-1 text-center text-[8px] text-slate-400">
                        <div className="py-0.5 flex flex-col items-center gap-0.5 text-emerald-400 font-bold">
                          <Waves className="w-3 h-3 text-emerald-400" />
                          <span>Kolam</span>
                        </div>
                        <div className="py-0.5 flex flex-col items-center gap-0.5 hover:text-slate-200">
                          <Package className="w-3 h-3" />
                          <span>Pakan</span>
                        </div>
                        <div className="py-0.5 flex flex-col items-center gap-0.5 hover:text-slate-200">
                          <FileText className="w-3 h-3" />
                          <span>Transaksi</span>
                        </div>
                        <div className="py-0.5 flex flex-col items-center gap-0.5 hover:text-slate-200">
                          <BarChart3 className="w-3 h-3" />
                          <span>Laba</span>
                        </div>
                      </div>
                    </div>

                    {/* Smartphone Home Indicator Bar */}
                    <div className="pt-1.5">
                      <div className="w-20 h-1 bg-slate-500/60 rounded-full mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 1. OFFLINE-FIRST & PWA SECTION */}
          <section id="offline-pwa" className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 lg:py-24 border-t border-[var(--border)]">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 items-center">
              {/* Left Column: Interactive Offline Architecture & Field Sync Simulation */}
              <div className="relative flex justify-center order-2 lg:order-1 w-full">
                <div className="w-full max-w-[460px] bg-slate-950 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-bold text-[13px] text-slate-100">Simulasi Sinkronisasi Lapangan</span>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                      IndexedDB + SW
                    </span>
                  </div>

                  {/* Visual 3-Stage Pipeline */}
                  <div className="space-y-3">
                    {/* Stage 1 */}
                    <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white">1. Input di Tengah Kolam (Tanpa Sinyal)</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">0ms Latency</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Kru input tonase panen lele atau sak pakan. Aplikasi tetap merespon super mulus tanpa loading spinner macet.
                        </p>
                      </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white">2. Penyimpanan Lokal HP (IndexedDB)</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">Persistent Storage</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Data terkunci rapat di memori peramban HP. Tidak akan hilang walau HP mati baterai atau aplikasi ditutup.
                        </p>
                      </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-emerald-500/30 flex items-start gap-3 bg-emerald-950/20">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white">3. Auto-Sync Cloud Saat Ada Sinyal</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">Real-time Hook</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Begitu kru balik ke saung / dapat sinyal 1 bar, antrian data terkirim otomatis. Laporan laba owner langsung ter-update!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Trigger Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPwaToastMsg("✓ Uji Coba Sync: Data lokal (25kg pakan B2) berhasil disinkronkan ke server pusat!");
                        setTimeout(() => setPwaToastMsg(null), 4000);
                      }}
                      className="w-full py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[12px] transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" /> Uji Coba Kirim Data Antrian Offline
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: PWA & Offline-First Explanation */}
              <div className="space-y-6 text-left order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-[#2BBF78] uppercase tracking-wider">
                  <Smartphone className="w-3.5 h-3.5 text-[#2BBF78]" /> • PWA • OFFLINE-FIRST • NO PLAYSTORE
                </div>

                <h2 className="display text-[30px] sm:text-[42px] font-[900] tracking-tight text-[var(--text)] leading-[1.1]">
                  Di kolam sinyal hilang, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4]">
                    aplikasi tetap jalan.
                  </span>
                </h2>

                <p className="text-[15px] sm:text-[17px] text-[var(--text-muted)] leading-relaxed max-w-[560px]">
                  TUMBU itu PWA installable. Gak perlu buka Play Store yang berat. Buka sekali di browser, langsung kesimpan di HP. Catat panen & pakan di tengah kolam tanpa sinyal, nanti otomatis sync begitu dapat WiFi atau sinyal. Manifest + Service Worker + IndexedDB.
                </p>

                {/* 4 Feature Pillars Grid */}
                <div className="grid sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
                    <div className="font-bold text-[14px] text-[var(--text)] flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#2BBF78]" /> Instant Load &lt;1s
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">App shell cached di memori HP, buka langsung cepat.</p>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
                    <div className="font-bold text-[14px] text-[var(--text)] flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-sky-500" /> IndexedDB Offline
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">Data lokal tersimpan aman di HP, gak bakalan hilang.</p>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
                    <div className="font-bold text-[14px] text-[var(--text)] flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-[#F2C900]" /> Background Sync
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">Antrian kirim otomatis saat koneksi internet kembali.</p>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1">
                    <div className="font-bold text-[14px] text-[var(--text)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Update Tanpa Review
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">Fitur baru langsung masuk seketika tanpa perlu unduh ulang.</p>
                  </div>
                </div>

                {/* Code Terminal Box: manifest.json */}
                <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-[11px] sm:text-[12px] border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" /> manifest.json
                    </span>
                    <span className="text-[10px] text-emerald-400">PWA config</span>
                  </div>
                  <pre className="overflow-x-auto text-slate-300 leading-relaxed">
{`{
  "name": "TUMBU OS - Fisheries Business OS",
  "short_name": "TUMBU",
  "display": "standalone",
  "theme_color": "#2BBF78",
  "offline": "IndexedDB + ServiceWorker"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* 2. AI ASISTEN PENCATATAN - MODE REVIEW ("Ngomong aja. TUMBU yang catat.") */}
          <section id="teman-catat" className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 lg:py-24 border-t border-[var(--border)]">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
              {/* Left Column: AI Voice & Tab Selector */}
              <div className="space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#F2C900]/15 text-[#F2C900] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-[#F2C900]" /> 🟡 AI ASISTEN PENCATATAN - MODE REVIEW
                </div>

                <h2 className="display text-[30px] sm:text-[44px] font-[900] tracking-tight text-[var(--text)] leading-[1.1]">
                  Ngomong aja. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4]">
                    TUMBU yang catat.
                  </span>
                </h2>

                <p className="text-[15px] sm:text-[17px] text-[var(--text-muted)] leading-relaxed max-w-[560px]">
                  Capek ngetik sambil tangan basah di kolam? Ngomong kayak ngobrol santai sama admin. AI kami ubah suara Anda jadi transaksi resmi, lengkap dengan kolam, sekat, dan hitungan laba seketika.
                </p>

                {/* 3 Interactive Samples Tabs */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {aiVoiceSamples.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLandingAiTab(idx)}
                      className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                        landingAiTab === idx
                          ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-sm"
                          : "bg-[var(--card)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--bg)]"
                      }`}
                    >
                      {s.tabLabel}
                    </button>
                  ))}
                </div>

                {/* Voice Live Waveform Box */}
                <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-[#2BBF78]" /> VOICE INPUT - LIVE WAVEFORM
                    </span>
                    <span className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                    </span>
                  </div>

                  {/* Animated Waveform Equalizer Bars */}
                  <div className="h-12 bg-[var(--bg)] rounded-xl px-4 flex items-center justify-between gap-1 border border-[var(--border)] overflow-hidden">
                    {Array.from({ length: 22 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full bg-gradient-to-t from-[#2BBF78] to-[#1DBAB0] ${
                          isVoiceActive
                            ? i % 5 === 0
                              ? "animate-wave-1"
                              : i % 5 === 1
                              ? "animate-wave-2"
                              : i % 5 === 2
                              ? "animate-wave-3"
                              : i % 5 === 3
                              ? "animate-wave-4"
                              : "animate-wave-5"
                            : "h-2 opacity-30"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Recording Status Subtext */}
                  <div className="flex items-center justify-between text-[12px] pt-1">
                    <div className="flex items-center gap-2 text-[var(--text)] font-semibold truncate max-w-[340px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span className="text-red-500 font-bold shrink-0">Mendengarkan...</span>
                      <span className="text-[var(--text-muted)] truncate">"{aiVoiceSamples[landingAiTab].voiceText.slice(0, 35)}..."</span>
                    </div>
                  </div>
                </div>

                {/* Accuracy & Voice Toggle Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[12px] font-bold text-[#2BBF78] bg-emerald-500/10 px-3 py-1.5 rounded-full">
                    ✓ Akurasi 96% • Bahasa Jawa ngoko & Indonesia OK
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVoiceActive(!isVoiceActive);
                      setLandingAiTab((prev) => (prev + 1) % aiVoiceSamples.length);
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--border)] text-[12px] font-bold text-[var(--text)] flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#1DBAB0]" /> Ganti Contoh ▾
                  </button>
                </div>
              </div>

              {/* Right Column: AI Monospace Typewriter Interface */}
              <div className="space-y-4">
                <div className="bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)] shadow-xl relative overflow-hidden space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-[12px]">
                        T
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--text)]">TUMBU AI</div>
                        <div className="text-[10px] text-[var(--text-muted)]">online • Terasmukul • {aiVoiceSamples[landingAiTab].context}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded bg-[#F2C900] text-slate-950 font-bold uppercase tracking-wider">
                      MONOSPACE TYPEWRITER
                    </span>
                  </div>

                  {/* User Speech Bubble */}
                  <div className="flex justify-end">
                    <div className="bg-slate-900 text-white dark:bg-slate-800 p-3.5 rounded-2xl rounded-tr-none text-[13px] max-w-[90%] shadow-sm">
                      <span className="block text-[10px] text-emerald-400 font-bold mb-1">Suara Masuk:</span>
                      "{aiVoiceSamples[landingAiTab].voiceText}"
                    </div>
                  </div>

                  {/* AI Response Bubble with Real-time JavaScript Typewriter */}
                  <div className="bg-[var(--bg)] p-4 rounded-2xl border border-[var(--border)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#2BBF78] font-bold uppercase tracking-wider">Respon Asisten Otomatis:</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{aiVoiceSamples[landingAiTab].latency}</span>
                    </div>

                    <div className="font-mono text-[13px] text-[var(--text)] whitespace-pre-line leading-relaxed min-h-[58px]">
                      {typewriterText}
                      <span className="animate-cursor font-bold text-[#2BBF78] ml-0.5">|</span>
                    </div>

                    {/* Quick Action Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {aiVoiceSamples[landingAiTab].chips.map((c, i) => (
                        <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[#2BBF78] border border-emerald-500/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Subcard explaining typewriter */}
                  <div className="p-3 rounded-xl bg-[var(--bg)]/60 border border-dashed border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                    <strong>Efek typewriter:</strong> Huruf muncul satu-satu secara mulus dengan kursor kedip. Mengubah rekaman suara menjadi data operasional real-time tanpa salah catat.
                  </div>

                  {/* Bottom Stats Triad */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border)] text-center">
                    <div className="bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--border)]">
                      <div className="text-[10px] text-[var(--text-muted)]">Latency</div>
                      <div className="text-[13px] font-extrabold text-[var(--text)] mt-0.5">{aiVoiceSamples[landingAiTab].latency}</div>
                    </div>
                    <div className="bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--border)]">
                      <div className="text-[10px] text-[var(--text-muted)]">Context</div>
                      <div className="text-[13px] font-extrabold text-[#2BBF78] mt-0.5 truncate">{aiVoiceSamples[landingAiTab].context}</div>
                    </div>
                    <div className="bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--border)]">
                      <div className="text-[10px] text-[var(--text-muted)]">Aksi</div>
                      <div className="text-[13px] font-extrabold text-sky-500 mt-0.5">{aiVoiceSamples[landingAiTab].action}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. WORKSPACE TEAM - INVITE BY ID SECTION */}
          <section id="teams" className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 lg:py-24 border-t border-[var(--border)]">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Column: Workspace Team Roles */}
              <div className="space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#3AA7D4]/10 text-[#3AA7D4] uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5 text-[#3AA7D4]" /> WORKSPACE TEAM - INVITE BY ID
                </div>

                <h2 className="display text-[30px] sm:text-[42px] font-[900] tracking-tight text-[var(--text)] leading-[1.1]">
                  Owner pantau, staff catat, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4]">
                    viewer gak bisa ngacak-ngacak.
                  </span>
                </h2>

                <p className="text-[15px] sm:text-[17px] text-[var(--text-muted)] leading-relaxed max-w-[560px]">
                  Undang tim pakai ID kolam, bukan email ribet yang bikin bingung anak buah di lapangan. Role jelas, jejak audit ada. Cocok buat kolam yang dijaga bergantian siang dan malam.
                </p>

                {/* 4 Role Badges */}
                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-[var(--card)] p-3.5 rounded-2xl border border-[var(--border)] flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#F2C900] shrink-0 mt-1.5" />
                    <div>
                      <div className="font-bold text-[13px] text-[var(--text)]">Owner</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Full akses + Hapus data</div>
                    </div>
                  </div>

                  <div className="bg-[var(--card)] p-3.5 rounded-2xl border border-[var(--border)] flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#2BBF78] shrink-0 mt-1.5" />
                    <div>
                      <div className="font-bold text-[13px] text-[var(--text)]">Admin</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Kelola transaksi & stok</div>
                    </div>
                  </div>

                  <div className="bg-[var(--card)] p-3.5 rounded-2xl border border-[var(--border)] flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#3AA7D4] shrink-0 mt-1.5" />
                    <div>
                      <div className="font-bold text-[13px] text-[var(--text)]">Staff</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Catat harian & pakan</div>
                    </div>
                  </div>

                  <div className="bg-[var(--card)] p-3.5 rounded-2xl border border-[var(--border)] flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                    <div>
                      <div className="font-bold text-[13px] text-[var(--text)]">Viewer</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Lihat doang tanpa ubah</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Invite by ID Card Mockup */}
              <div className="bg-[var(--card)] rounded-3xl p-6 sm:p-7 border border-[var(--border)] shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#1DBAB0]" />
                    <span className="text-[13px] font-bold text-[var(--text)]">INVITE - ID KOLAM</span>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
                    ID Aktif
                  </span>
                </div>

                {/* ID Copyable Box */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Kode Undangan Workspace
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="TMB-A3-2026-09"
                      className="w-full h-11 px-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] font-mono font-bold text-[14px] text-[var(--text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCopiedInviteId(true);
                        setPwaToastMsg("Kode ID Kolam 'TMB-A3-2026-09' berhasil disalin!");
                        setTimeout(() => {
                          setCopiedInviteId(false);
                          setPwaToastMsg(null);
                        }, 3000);
                      }}
                      className="h-11 px-5 rounded-xl bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold text-[12px] flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shrink-0 border-0"
                    >
                      {copiedInviteId ? <Check className="w-4 h-4 text-emerald-400 dark:text-slate-950" /> : <Copy className="w-4 h-4" />}
                      {copiedInviteId ? "Tersalin!" : "Salin"}
                    </button>
                  </div>
                </div>

                {/* Live Member Status List */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Anggota Terdaftar di Kolam
                  </span>

                  <div className="space-y-2 text-[12px]">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#F2C900]/20 text-[#F2C900] font-bold flex items-center justify-center text-[11px]">
                          B
                        </div>
                        <span className="font-bold text-[var(--text)]">Pak Budi (Owner)</span>
                      </div>
                      <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> online
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#3AA7D4]/20 text-[#3AA7D4] font-bold flex items-center justify-center text-[11px]">
                          E
                        </div>
                        <span className="font-bold text-[var(--text)]">Edi (Staff A3)</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">catat pakan • 2m ago</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-500/20 text-slate-400 font-bold flex items-center justify-center text-[11px]">
                          Y
                        </div>
                        <span className="font-bold text-[var(--text)]">Yusuf (Viewer)</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">lihat laporan</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. SOCIAL PROOF / TESTIMONI PETANI TAMBAK */}
          <section id="testimoni" className="bg-[var(--card)] border-y border-[var(--border)] py-16 lg:py-24">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-[650px] mx-auto space-y-3 mb-12">
                <span className="text-[#F2C900] text-[11px] font-extrabold tracking-wider uppercase bg-[#F2C900]/10 px-3 py-1 rounded-full text-[#F2C900]">
                  Cerita Pembudidaya & Pedagang
                </span>
                <h2 className="display text-[28px] sm:text-[38px] font-[800] text-[var(--text)] leading-tight">
                  Nyata Dipakai di Lapangan Sawah & Tambak
                </h2>
                <p className="text-[14px] sm:text-[16px] text-[var(--text-muted)]">
                  Dari petani lele Sleman sampai pedagang ikan Boyolali, semua merasakan kemudahan pencatatan tanpa kertas sobek.
                </p>
              </div>

              {/* 2 Big Testimonial Cards */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Card 1 */}
                <div className="bg-[var(--bg)] p-6 sm:p-7 rounded-3xl border border-[var(--border)] space-y-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-[#2BBF78] font-black flex items-center justify-center text-[16px]">
                        M
                      </div>
                      <div>
                        <div className="font-extrabold text-[15px] text-[var(--text)]">Mas Yusuf - Mina Makmur</div>
                        <div className="text-[12px] text-[var(--text-muted)]">Sleman • 18 kolam</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-md bg-[#F2C900] text-slate-950 font-bold uppercase">
                      ROI +38% • FCR 1.08
                    </span>
                  </div>

                  <p className="text-[14px] text-[var(--text)] leading-relaxed italic">
                    "Dulu bon hilang terus, sekarang foto BA langsung masuk OS. Laba siklus 12 naik 26% karena FCR ke-track bener. Petani lele wajib punya."
                  </p>
                </div>

                {/* Card 2 */}
                <div className="bg-[var(--bg)] p-6 sm:p-7 rounded-3xl border border-[var(--border)] space-y-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-sky-500/20 text-sky-500 font-black flex items-center justify-center text-[16px]">
                        E
                      </div>
                      <div>
                        <div className="font-extrabold text-[15px] text-[var(--text)]">Bu Endang - Sri Rejeki</div>
                        <div className="text-[12px] text-[var(--text-muted)]">Boyolali • 32 kolam</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-md bg-[#F2C900] text-slate-950 font-bold uppercase">
                      Offline-First • Teruji
                    </span>
                  </div>

                  <p className="text-[14px] text-[var(--text)] leading-relaxed italic">
                    "Staff ganti-ganti, tapi data gak hilang. PWA-nya jalan walau sinyal cuma 1 bar di sawah. Owner bisa cek dari pasar. Enak pol."
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. FRIENDLY FARMER CTA SECTION */}
          <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
            <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white rounded-3xl p-8 sm:p-14 space-y-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              <span className="text-[#F2C900] text-[11px] font-extrabold tracking-wider uppercase bg-[#F2C900]/15 px-3 py-1 rounded-full border border-[#F2C900]/30 inline-block">
                Sistem Pencatatan No. 1 Tambak & Pasar Ikan
              </span>

              <h2 className="display text-[32px] sm:text-[46px] font-[900] tracking-tight leading-tight max-w-[720px] mx-auto">
                Mulai Sekarang, Bikin Usaha Tambak & Penjualan Rapi Tanpa Ribet
              </h2>

              <p className="text-slate-300 text-[14px] sm:text-[16px] max-w-[620px] mx-auto leading-relaxed">
                Tinggalkan cara lama yang bikin pusing dan rawan bon hilang. Cukup buka TUMBU OS di HP atau laptop Anda, nikmati pencatatan cerdas yang tetap jalan meski sinyal hilang.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => startAuth('register')}
                  className="h-12 px-8 rounded-full bg-gradient-to-r from-[#2BBF78] via-[#1DBAB0] to-[#3AA7D4] text-white font-bold text-[14px] shadow-lg hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer border-0"
                >
                  Daftar Usaha Gratis Sekarang <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => startAuth('login')}
                  className="h-12 px-6 rounded-full border border-slate-600 hover:bg-slate-800 text-slate-200 font-semibold text-[14px] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-400" /> Masuk ke Akun
                </button>
              </div>
            </div>
          </section>

          {/* 6. CLEAR & PROFESSIONAL TUMBU OS FOOTER */}
          <footer className="border-t border-[var(--border)] bg-[var(--card)] py-14 lg:py-16">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
                {/* Column 1: Brand, Tagline & Mission Description */}
                <div className="md:col-span-6 lg:col-span-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <img src={logoIconUrl} alt="TUMBU" className="w-10 h-10 object-contain shrink-0" />
                    <div>
                      <span className="font-black text-[22px] tracking-tight block text-[var(--text)] leading-tight">TUMBU</span>
                      <span className="text-[12px] font-bold text-[#2BBF78] block tracking-wide">Hybrid Business OS Perikanan</span>
                    </div>
                  </div>
                  <p className="text-[13.5px] text-[var(--text-muted)] leading-relaxed max-w-md">
                    Sistem operasi cerdas offline-first untuk digitalisasi operasional budidaya, distribusi benih ikan, pakan, dan manajemen transaksi keuangan secara transparan di seluruh sentra perikanan Indonesia.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-[#2BBF78]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2BBF78] animate-pulse" />
                    PWA Offline-First • Kesiapan Jaringan 0-Bar
                  </div>
                </div>

                {/* Column 2: Navigasi Fitur */}
                <div className="md:col-span-3 lg:col-span-3 space-y-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text)] block">
                    Navigasi Fitur
                  </span>
                  <div className="flex flex-col gap-2.5 text-[13px] text-[var(--text-muted)] font-medium">
                    <button type="button" onClick={() => scrollTo('hero')} className="text-left hover:text-[#2BBF78] transition border-0 bg-transparent p-0 cursor-pointer">
                      Beranda
                    </button>
                    <button type="button" onClick={() => scrollTo('offline-pwa')} className="text-left hover:text-[#2BBF78] transition border-0 bg-transparent p-0 cursor-pointer">
                      Fitur Offline & PWA
                    </button>
                    <button type="button" onClick={() => scrollTo('teman-catat')} className="text-left hover:text-[#2BBF78] transition border-0 bg-transparent p-0 cursor-pointer">
                      AI Voice Asisten Catat
                    </button>
                    <button type="button" onClick={() => scrollTo('teams')} className="text-left hover:text-[#2BBF78] transition border-0 bg-transparent p-0 cursor-pointer">
                      Tim Workspace (ID)
                    </button>
                    <button type="button" onClick={() => scrollTo('distributor-sec')} className="text-left hover:text-[#2BBF78] transition border-0 bg-transparent p-0 cursor-pointer">
                      Solusi Distributor Benih
                    </button>
                    <button type="button" onClick={() => startAuth('login')} className="text-left font-bold text-[#2BBF78] hover:underline transition cursor-pointer border-0 bg-transparent p-0 pt-1">
                      Masuk ke Akun →
                    </button>
                  </div>
                </div>

                {/* Column 3: Kontak & Sentra Operasional */}
                <div className="md:col-span-3 lg:col-span-4 space-y-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text)] block">
                    Kontak & Sentra
                  </span>
                  <div className="space-y-3.5 text-[13px]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Email Resmi</span>
                      <a href="mailto:halo@tumbu.web.id" className="font-semibold text-[var(--text)] hover:text-[#2BBF78] transition no-underline block">
                        halo@tumbu.web.id
                      </a>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Telepon & WhatsApp</span>
                      <a href="tel:+628975196393" className="font-semibold text-[var(--text)] hover:text-[#2BBF78] transition no-underline block">
                        +62 897-5196-393
                      </a>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Sentra Operasional</span>
                      <span className="font-semibold text-[var(--text)] block">
                        Parung, Kabupaten Bogor, Jawa Barat
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Copyright & Guarantee */}
              <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-center text-[12px] text-[var(--text-muted)] gap-3">
                <p>© 2026 Tumbu Hybrid Business OS. Seluruh hak cipta dilindungi.</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" /> Dirancang offline-first untuk kedaulatan data pelaku usaha perikanan Indonesia.
                </p>
              </div>
            </div>
          </footer>

          {/* Floating Toast Notification for PWA Install and Copy events */}
          <AnimatePresence>
            {pwaToastMsg && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 font-bold text-[13px] border border-emerald-500/30"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-slate-950 shrink-0" />
                <span>{pwaToastMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}

      {/* 3. AUTH VIEW / LOGIN & REGISTER CONTAINER (LIGHT THEME) */}
      {view === 'auth' && (
        <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-100 transition-colors duration-300 overflow-y-auto">
          {/* Subtle Ambient Background Elements */}
          <div className="absolute w-[450px] h-[450px] rounded-full bg-emerald-200/40 blur-3xl top-10 left-10 pointer-events-none" />
          <div className="absolute w-[450px] h-[450px] rounded-full bg-sky-200/40 blur-3xl bottom-10 right-10 pointer-events-none" />

          <AnimatePresence mode="wait">
            {authMode === 'login' ? (
              <motion.div
                key="login-card"
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="w-full max-w-md mx-auto my-auto bg-white border border-slate-200/90 rounded-[28px] p-6 sm:p-8 relative z-10 text-slate-900 shadow-2xl shadow-slate-300/40"
              >
                {/* BRANDING HEADER WITH HOMEPAGE ICON INSIDE CONTAINER & ENTER LINE BREAK */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col gap-2">
                    <img src={logoIconUrl} alt="TUMBU" className="w-10 h-10 object-contain shrink-0" />
                    <div>
                      <h1 className="display text-[22px] font-black text-slate-900 leading-tight">
                        Masuk ke <br />
                        <span className="text-[#2BBF78]">TUMBU OS</span>
                      </h1>
                      <p className="text-[12px] text-slate-500 mt-0.5 font-medium">Business OS Perikanan & Tambak Indonesia</p>
                    </div>
                  </div>

                  {/* Home Icon Button inside login card */}
                  <button
                    type="button"
                    onClick={() => scrollTo('hero')}
                    className="w-10 h-10 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer p-0 bg-transparent shrink-0"
                    title="Kembali ke Beranda"
                    aria-label="Kembali ke Beranda"
                  >
                    <Home className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); void handleLogin(); }} className="w-full space-y-4">
                  <div className="w-full">
                    <label className="block text-[12px] font-bold mb-1 text-slate-700">Email Akun</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#2BBF78] focus:ring-2 focus:ring-[#2BBF78]/20 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium"
                      placeholder="email@domain.com"
                      disabled={authLoading}
                    />
                  </div>

                  <div className="w-full">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[12px] font-bold text-slate-700">Password</label>
                      <span className="text-[11px] text-[#2BBF78] font-bold hover:underline cursor-pointer">Lupa Password?</span>
                    </div>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#2BBF78] focus:ring-2 focus:ring-[#2BBF78]/20 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium"
                      placeholder="••••••••"
                      disabled={authLoading}
                    />
                  </div>

                  {error && (
                    <div className="rounded-[12px] px-3.5 py-2.5 text-[12px] bg-red-50 border border-red-200 text-red-600 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-12 rounded-full bg-gradient-to-r from-[#2BBF78] to-[#1DBAB0] hover:opacity-95 text-white font-bold text-[14px] shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer border-0"
                  >
                    {authLoading ? 'Memproses...' : 'Login ke Workspace'} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* DAFTAR USAHA BARU LINK */}
                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-[13px] text-slate-600 font-medium">
                  Belum punya workspace?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setError(null); }}
                    className="font-bold text-[#2BBF78] hover:underline cursor-pointer bg-transparent border-0 p-0 inline ml-1"
                  >
                    Daftar Usaha Baru
                  </button>
                </div>
              </motion.div>
            ) : (
              /* REGISTER CARD */
              <motion.div
                key="register-card"
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="w-full max-w-md mx-auto my-auto bg-white border border-slate-200/90 rounded-[28px] p-6 sm:p-8 relative z-10 text-slate-900 shadow-2xl shadow-slate-300/40"
              >
                {/* BRANDING HEADER WITH HOMEPAGE ICON INSIDE CONTAINER & ENTER LINE BREAK */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-col gap-2">
                    <img src={logoIconUrl} alt="TUMBU" className="w-10 h-10 object-contain shrink-0" />
                    <div>
                      <h1 className="display text-[22px] font-black text-slate-900 leading-tight">
                        Daftar Usaha Baru <br />
                        <span className="text-[#2BBF78]">TUMBU OS</span>
                      </h1>
                      <p className="text-[12px] text-slate-500 mt-0.5 font-medium">Business OS Perikanan & Tambak Indonesia</p>
                    </div>
                  </div>

                  {/* Home Icon Button inside register card */}
                  <button
                    type="button"
                    onClick={() => scrollTo('hero')}
                    className="w-10 h-10 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer p-0 bg-transparent shrink-0"
                    title="Kembali ke Beranda"
                    aria-label="Kembali ke Beranda"
                  >
                    <Home className="w-5 h-5" />
                  </button>
                </div>

                {/* ONBOARDING JOURNEY PROGRESSION INDICATOR */}
                <div className="mb-5 p-3 rounded-[16px] bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Tahapan Onboarding</span>
                    <span className="text-[#2BBF78] font-extrabold">Langkah 1/5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-[9px] text-center font-bold text-slate-500">
                    <div className="py-1 px-0.5 rounded-lg bg-[#2BBF78] text-white">1. Akun</div>
                    <div className="py-1 px-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">2. Email</div>
                    <div className="py-1 px-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">3. Blueprint</div>
                    <div className="py-1 px-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">4. Workspace</div>
                    <div className="py-1 px-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">5. Siap</div>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); void handleRegister(); }} className="w-full space-y-4">
                  <div className="w-full">
                    <label className="block text-[12px] font-bold mb-1 text-slate-700">Nama Pemilik / Usaha Tambak</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                      className="w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#2BBF78] focus:ring-2 focus:ring-[#2BBF78]/20 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium"
                      placeholder="Pak Budi / Sumber Lele Sleman"
                      disabled={authLoading}
                    />
                  </div>

                  <div className="w-full">
                    <label className="block text-[12px] font-bold mb-1 text-slate-700">Email Utama</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#2BBF78] focus:ring-2 focus:ring-[#2BBF78]/20 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium"
                      placeholder="budi@sumberlele.id"
                      disabled={authLoading}
                    />
                  </div>

                  <div className="w-full">
                    <label className="block text-[12px] font-bold mb-1 text-slate-700">Password Baru</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className="w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#2BBF78] focus:ring-2 focus:ring-[#2BBF78]/20 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium"
                      placeholder="••••••••"
                      disabled={authLoading}
                    />
                  </div>

                  <div className="w-full">
                    <label className="block text-[12px] font-bold mb-1 text-slate-700">Ulangi Password</label>
                    <input
                      type="password"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className={`w-full box-border h-11 px-3.5 rounded-[12px] bg-slate-50 border ${authConfirmPassword && authPassword !== authConfirmPassword ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#2BBF78] focus:ring-[#2BBF78]/20'} focus:bg-white focus:ring-2 outline-none text-[14px] text-slate-900 placeholder:text-slate-400 transition-all font-medium`}
                      placeholder="Ulangi password di atas..."
                      disabled={authLoading}
                    />
                    {authConfirmPassword && authPassword !== authConfirmPassword && (
                      <p className="text-[11px] text-red-500 mt-1 font-semibold">Password tidak cocok</p>
                    )}
                  </div>

                  {/* Persetujuan Platform & Ketentuan Layanan */}
                  <div className="flex items-start gap-2.5 pt-1 pb-1">
                    <input
                      type="checkbox"
                      id="register-terms-agree"
                      checked={authAgreedTerms}
                      onChange={(e) => setAuthAgreedTerms(e.target.checked)}
                      required
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#2BBF78] focus:ring-[#2BBF78] cursor-pointer"
                    />
                    <label htmlFor="register-terms-agree" className="text-[12px] text-slate-600 leading-snug cursor-pointer select-none">
                      Saya menyetujui <span className="text-[#2BBF78] font-bold">Ketentuan Layanan</span>, <span className="text-[#2BBF78] font-bold">Kebijakan Privasi</span>, serta kepatuhan platform TUMBU OS.
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-[12px] px-3.5 py-2.5 text-[12px] bg-red-50 border border-red-200 text-red-600 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-12 rounded-full bg-gradient-to-r from-[#2BBF78] to-[#1DBAB0] text-white font-bold text-[14px] shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer border-0"
                  >
                    {authLoading ? 'Memproses pendaftaran...' : 'Buat Akun Usaha Gratis'} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-[13px] text-slate-600 font-medium">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(null); }}
                    className="font-bold text-[#2BBF78] hover:underline cursor-pointer bg-transparent border-0 p-0 inline ml-1"
                  >
                    Masuk Sekarang
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 4. BLUEPRINT SELECTION VIEW */}
      {view === 'blueprintSelect' && (
        <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-[800px] space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] uppercase tracking-wider">
                Langkah 1 dari 2
              </span>
              <h1 className="text-[28px] sm:text-[36px] font-bold text-[var(--text)]">Pilih Blueprint Operasional Workspace</h1>
              <p className="text-[14px] text-[var(--text-muted)] max-w-[500px] mx-auto">
                Pilih modul bisnis yang paling sesuai dengan aktivitas utama usaha Anda.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setSelectedBlueprint('distributor')}
                className={`p-6 rounded-[24px] text-left transition cursor-pointer border-2 ${selectedBlueprint === 'distributor' ? 'bg-[var(--card)] border-[#0EA5E9] shadow-xl' : 'clay border-transparent hover:border-[var(--border-strong)]'}`}
              >
                <div className="w-12 h-12 rounded-[16px] bg-[#0EA5E9] text-white flex items-center justify-center font-bold mb-4">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[18px] text-[var(--text)]">Distributor Benih</h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                  Fokus pada stok benih per ukuran (cm/ekor), Surat Jalan (SJ), pencatatan piutang pelanggan, dan kas harian.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBlueprint('budidaya')}
                className={`p-6 rounded-[24px] text-left transition cursor-pointer border-2 ${selectedBlueprint === 'budidaya' ? 'bg-[var(--card)] border-[#22C55E] shadow-xl' : 'clay border-transparent hover:border-[var(--border-strong)]'}`}
              >
                <div className="w-12 h-12 rounded-[16px] bg-[#22C55E] text-white flex items-center justify-center font-bold mb-4">
                  <Waves className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[18px] text-[var(--text)]">Pembudidaya Air Tawar</h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                  Fokus pada manajemen siklus kolam (DOC), tebar & sampling ABW/SR, hitung FCR pakan, dan laba-rugi panen.
                </p>
              </button>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={() => setView('setup')}
                className="h-12 px-8 rounded-full bg-[#0F172A] text-white font-bold text-[14px] flex items-center gap-2 shadow-lg hover:bg-slate-800 transition cursor-pointer"
              >
                Lanjutkan Setup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SETUP WORKSPACE VIEW */}
      {view === 'setup' && (
        <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-[500px] clay rounded-[28px] p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] uppercase tracking-wider">
                Langkah 2 dari 2
              </span>
              <h1 className="text-[24px] font-bold text-[var(--text)] mt-2">Beri Nama Workspace Usaha</h1>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">
                Contoh: Hatchery Sumber Lele, Tambak Udang Barokah, dll.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--text)] mb-1">Nama Workspace</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[14px] outline-none focus:border-[#0EA5E9]"
                  placeholder="Nama Usaha Anda"
                />
              </div>

              <button
                onClick={async () => {
                  if (!workspaceName.trim()) {
                    showToast('Nama workspace wajib diisi');
                    return;
                  }
                  setWorkspaceSaving(true);
                  try {
                    const created = await platformApi.createMyWorkspace(
                      authToken || '',
                      {
                        name: workspaceName.trim(),
                        blueprintId: BLUEPRINT_IDS[selectedBlueprint],
                      }
                    );
                    showToast('Workspace berhasil dibuat!');
                    routeToWorkspace(created);
                  } catch {
                    showToast('Gagal membuat workspace');
                  } finally {
                    setWorkspaceSaving(false);
                  }
                }}
                disabled={workspaceSaving}
                className="w-full h-12 rounded-full bg-[#0F172A] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                {workspaceSaving ? 'Membuat Workspace...' : 'Buka Dashboard Usaha'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DASHBOARD WORKSPACE & ADMIN PLATFORM WITH COLLAPSIBLE SIDEBAR */}
      {(view === 'distributor' || view === 'budidaya' || view === 'platform') && (
        <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)] relative">
          {/* Backdrop overlay for mobile drawer */}
          {sidebarMobileOpen && (
            <div
              onClick={() => setSidebarMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
            />
          )}

          {/* SIDEBAR NAVIGATION */}
          <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 flex flex-col shrink-0 ${sidebarCollapsed ? 'lg:w-[72px] w-[260px]' : 'w-[260px]'} ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            
            {/* Floating Sidebar Expand/Collapse Toggle Button on Border Line (Prevents overlapping logo) */}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="hidden lg:flex absolute -right-3.5 top-5 z-50 w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-md text-[var(--text-muted)] hover:text-[var(--text)] hover:scale-110 transition-all items-center justify-center cursor-pointer p-0"
              title={sidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>

            {/* Sidebar Top Branding Header */}
            <div className={`h-[68px] px-4 flex items-center border-b border-[var(--border)] shrink-0 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <img src={logoIconUrl} alt="TUMBU" className="w-8 h-8 object-contain shrink-0" />
                {!sidebarCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[15px] tracking-tight text-[var(--text)] truncate">TUMBU OS</span>
                    <span className="text-[10px] text-[#0EA5E9] font-semibold truncate">
                      {view === 'platform' ? 'Platform Admin Master' : (view === 'budidaya' ? 'Budidaya Air Tawar' : 'Distributor Benih')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Workspace Info */}
            {!sidebarCollapsed ? (
              <div className="p-2.5 mx-3 my-2.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                    {view === 'platform' ? 'Control Plane' : 'Workspace Aktif'}
                  </div>
                  <div className="font-bold text-[13px] text-[var(--text)] truncate">
                    {view === 'platform' ? 'System Control Master' : workspaceName}
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${view === 'platform' ? 'bg-[#0EA5E9]' : 'bg-[#22C55E]'}`} />
              </div>
            ) : (
              <div className="my-2 text-center">
                <span className={`w-2 h-2 rounded-full inline-block ${view === 'platform' ? 'bg-[#0EA5E9]' : 'bg-[#22C55E]'}`} title={view === 'platform' ? 'System Control Master' : workspaceName} />
              </div>
            )}

            {/* Navigation Modules Menu Grouped by Function/Category */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
              {Array.from(new Set(activeModules.map(m => m.category || 'MENU'))).map((cat) => {
                const catItems = activeModules.filter(m => (m.category || 'MENU') === cat);
                return (
                  <div key={cat} className="space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-3 pt-1 pb-1 text-[9px] font-extrabold tracking-wider text-[var(--text-muted)] uppercase opacity-75">
                        {cat}
                      </div>
                    )}
                    {catItems.map((m) => {
                      const Icon = m.icon;
                      const isActive = workspaceModuleTab === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setWorkspaceModuleTab(m.id);
                            if (view === 'platform') {
                              setPlatformTab(m.id as any);
                            }
                            setSidebarMobileOpen(false);
                          }}
                          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3'} py-2 rounded-xl text-[13px] transition-all duration-150 cursor-pointer border-0 ${
                            isActive
                              ? 'bg-[#0EA5E9] text-white shadow-sm font-bold'
                              : 'bg-transparent text-[var(--text-muted)] hover:text-[#0EA5E9] hover:bg-[#0EA5E9]/10 font-medium'
                          }`}
                          title={sidebarCollapsed ? m.label : undefined}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : ''}`} />
                          {!sidebarCollapsed && <span className="truncate ml-2.5">{m.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Sidebar Bottom Section: PWA, Console Switch, Theme & Logout */}
            <div className="p-2 border-t border-[var(--border)] space-y-1 shrink-0">
              {/* PWA Mobile App Menu Entry */}
              <button
                onClick={() => {
                  setShowPwaModal(true);
                  setSidebarMobileOpen(false);
                }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3'} py-2 rounded-xl text-[12px] font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/10 transition-all cursor-pointer border-0`}
                title={sidebarCollapsed ? "Aplikasi Mobile (PWA)" : undefined}
              >
                <Smartphone className="w-4 h-4 shrink-0 text-[#0EA5E9]" />
                {!sidebarCollapsed && <span className="ml-2.5 truncate">Aplikasi Mobile (PWA)</span>}
              </button>

              {/* Mode Terang / Mode Gelap Toggle */}
              <button
                onClick={toggleTheme}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[#0EA5E9] hover:bg-[#0EA5E9]/10 transition-all cursor-pointer border-0`}
                title={sidebarCollapsed ? (theme === 'light' ? 'Mode Gelap' : 'Mode Terang') : undefined}
              >
                <div className="flex items-center">
                  {theme === 'light' ? <Moon className="w-4 h-4 shrink-0 text-slate-600" /> : <Sun className="w-4 h-4 shrink-0 text-[#F8BF24]" />}
                  {!sidebarCollapsed && <span className="ml-2.5">{theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</span>}
                </div>
                {!sidebarCollapsed && (
                  <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${theme === 'dark' ? 'bg-[#0EA5E9]' : 'bg-slate-300'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-3' : 'translate-x-0'}`} />
                  </div>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3'} py-2 rounded-xl text-[12px] font-semibold text-red-500 hover:bg-red-500/10 transition-all cursor-pointer border-0`}
                title={sidebarCollapsed ? "Logout" : undefined}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="ml-2.5">Logout</span>}
              </button>
            </div>
          </aside>

          {/* MAIN DASHBOARD CONTENT */}
          <div className="flex-1 min-w-0 flex flex-col min-h-screen">
            {/* Top Dashboard Header */}
            <header className="h-[68px] px-4 sm:px-6 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarMobileOpen(o => !o)}
                  className="lg:hidden w-9 h-9 rounded-lg clay flex items-center justify-center p-0 cursor-pointer"
                >
                  <Menu className="w-5 h-5 text-[var(--text)]" />
                </button>
                <h1 className="font-bold text-[18px] text-[var(--text)] truncate">
                  {activeModules.find(m => m.id === workspaceModuleTab)?.label || 'Dashboard'}
                </h1>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => setShowPwaModal(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] hover:bg-[#0EA5E9]/20 text-[11px] font-bold border border-[#0EA5E9]/20 transition cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Akses PWA / HP</span>
                  <span className="sm:hidden text-[10px]">PWA</span>
                </button>

                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-bold border border-[#22C55E]/20">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
                  <span className="hidden sm:inline">Offline Ready</span>
                  <span className="sm:hidden text-[10px]">Offline</span>
                </div>
              </div>
            </header>

            {/* Operational Content Body */}
            <main className="p-4 sm:p-6 lg:p-8 flex-1">
              {view === 'platform' ? (
                <PlatformAdminSkin
                  workspaceName={workspaceName}
                  activeWorkspace={activeWorkspace}
                  platformTab={workspaceModuleTab}
                  onNotify={showToast}
                >
                  {authToken ? (
                    <PlatformPages
                      page={workspaceModuleTab}
                      apiFetch={apiFetch}
                      onNotify={showToast}
                      onRefreshShell={async () => {
                        const list = await platformApi.workspaces(authToken);
                        setPlatformWorkspacesList(list);
                      }}
                      onOpenWorkspace={async (id) => {
                        const ws = platformWorkspacesList.find((w: any) => w.id === id);
                        if (ws) {
                          await activateWorkspace(ws);
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-6 max-w-[1200px]">
                    {/* RINGKASAN PLATFORM (OVERVIEW) */}
                    {workspaceModuleTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          <div className="clay rounded-[18px] p-5 space-y-1">
                            <div className="text-[12px] text-[var(--text-muted)]">Total Workspace Member</div>
                            <div className="text-[26px] font-extrabold text-[#0EA5E9]">
                              {platformOverview?.totalWorkspaces ?? platformWorkspacesList.length ?? 0}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">Terhubung ke Firestore Backend</div>
                          </div>
                          <div className="clay rounded-[18px] p-5 space-y-1">
                            <div className="text-[12px] text-[var(--text-muted)]">Workspace Aktif</div>
                            <div className="text-[26px] font-extrabold text-[#22C55E]">
                              {platformOverview?.activeWorkspaces ?? platformWorkspacesList.filter((w: any) => w.status === 'ACTIVE').length ?? 0}
                            </div>
                            <div className="text-[11px] text-[#22C55E] font-medium">Terverifikasi & Aktif</div>
                          </div>
                          <div className="clay rounded-[18px] p-5 space-y-1">
                            <div className="text-[12px] text-[var(--text-muted)]">Pending Approval</div>
                            <div className="text-[26px] font-extrabold text-amber-500">
                              {platformOverview?.pendingWorkspaces ?? platformWorkspacesList.filter((w: any) => w.status === 'PENDING').length ?? 0}
                            </div>
                            <div className="text-[11px] text-amber-500 font-medium">Menunggu persetujuan admin</div>
                          </div>
                        </div>
                        {/* WIDGET AKSI CEPAT APPROVAL WORKSPACE BARU */}
                        {platformWorkspacesList.filter((w: any) => w.status === "PENDING").length > 0 && (
                          <div className="clay rounded-[20px] p-6 border-2 border-amber-500/40 bg-amber-500/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">
                                  🔔 {platformWorkspacesList.filter((w: any) => w.status === "PENDING").length}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-base text-[var(--text)]">
                                    Pendaftaran Member Baru Menunggu Persetujuan (ACC)
                                  </h3>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Verifikasi pendaftaran dan pembayaran lisensi member baru di bawah ini:
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setWorkspaceModuleTab("workspaces")}
                                className="text-xs font-bold text-[#0EA5E9] hover:underline"
                              >
                                Lihat Semua &rarr;
                              </button>
                            </div>

                            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
                              {platformWorkspacesList
                                .filter((w: any) => w.status === "PENDING")
                                .map((ws: any) => (
                                  <div key={ws.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm text-[var(--text)]">{ws.name}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600">
                                          PENDING
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-[var(--text-muted)]">
                                          {ws.blueprintId || "Distributor Benih"}
                                        </span>
                                      </div>
                                      <div className="text-xs text-[var(--text-muted)] mt-1">
                                        Owner: <span className="font-medium text-[var(--text)]">{ws.ownerEmail || ws.ownerName || "-"}</span> | ID: <span className="font-mono">{ws.id}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleUpdateWorkspaceStatus(ws.id, "ACTIVE")}
                                        className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-600 text-white text-xs font-extrabold transition shadow flex items-center gap-1.5"
                                      >
                                        ✓ ACC & Aktifkan
                                      </button>
                                      <button
                                        onClick={() => handleUpdateWorkspaceStatus(ws.id, "SUSPENDED")}
                                        className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold transition"
                                      >
                                        Tolak
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Additional Platform Welcome Card */}
                        <div className="clay rounded-[20px] p-6 space-y-4">
                          <h3 className="font-bold text-[16px] text-[var(--text)]">Selamat Datang di Tumbu OS Control Plane</h3>
                          <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                            Gunakan menu navigasi sidebar di sebelah kiri untuk mengelola katalog blueprint usaha, melakukan audit keamanan, mengonfigurasi lisensi billing, dan memantau operasional platform secara real-time.
                          </p>
                          <div className="pt-2">
                            <div className="p-4 rounded-xl bg-[#0EA5E9]/5 border border-[#0EA5E9]/20 flex items-center justify-between">
                              <span className="text-[12px] font-medium text-[var(--text)]">Membutuhkan bantuan teknis atau operasional?</span>
                              <button
                                onClick={() => setWorkspaceModuleTab('settings')}
                                className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white text-[11px] font-bold hover:bg-[#0284C7] transition cursor-pointer"
                              >
                                Pengaturan Sistem
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DAFTAR WORKSPACE (WORKSPACES) */}
                    {workspaceModuleTab === 'workspaces' && (
                      <div className="space-y-6">
                        {/* Workspaces Management Table */}
                        <div className="clay rounded-[20px] p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Workspace Member Platform</h3>
                              <p className="text-[12px] text-[var(--text-muted)]">Manajemen penuh status workspace, blueprint usaha, dan kontrol akses</p>
                            </div>
                            {platformLoading && <span className="text-[12px] text-[#0EA5E9] font-medium animate-pulse">Memuat data...</span>}
                          </div>

                          {/* Search & Filter Bar */}
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <input
                              type="text"
                              placeholder="Cari nama workspace, email pemilik..."
                              value={platformSearch}
                              onChange={(e) => setPlatformSearch(e.target.value)}
                              className="w-full sm:w-80 h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[12px] text-[var(--text)] outline-none focus:border-[#0EA5E9]"
                            />
                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                              {(['ALL', 'ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'] as const).map((st) => (
                                <button
                                  key={st}
                                  onClick={() => setPlatformStatusFilter(st)}
                                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition shrink-0 ${
                                    platformStatusFilter === st
                                      ? 'bg-[#0EA5E9] text-white'
                                      : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  {st === 'ALL' ? 'Semua Status' : st}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                              <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                                  <th className="pb-3 font-semibold">Nama Workspace</th>
                                  <th className="pb-3 font-semibold">Pemilik / Email</th>
                                  <th className="pb-3 font-semibold">Blueprint Usaha</th>
                                  <th className="pb-3 font-semibold">Status Workspace</th>
                                  <th className="pb-3 font-semibold text-right">Aksi Admin Kontrol</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {platformWorkspacesList
                                  .filter((ws: any) => {
                                    const matchSearch =
                                      !platformSearch.trim() ||
                                      (ws.name || '').toLowerCase().includes(platformSearch.toLowerCase()) ||
                                      (ws.ownerEmail || ws.ownerName || '').toLowerCase().includes(platformSearch.toLowerCase());
                                    const matchStatus =
                                      platformStatusFilter === 'ALL' || ws.status === platformStatusFilter;
                                    return matchSearch && matchStatus;
                                  })
                                  .map((ws: any) => (
                                    <tr key={ws.id} className="hover:bg-[var(--bg)] transition-colors">
                                      <td className="py-3.5 font-bold text-[var(--text)]">{ws.name}</td>
                                      <td className="py-3.5 text-[var(--text-muted)]">{ws.ownerEmail || ws.ownerName || '-'}</td>
                                      <td className="py-3.5">
                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0EA5E9]/10 text-[#0EA5E9]">
                                          {ws.blueprintId || 'Distributor Benih'}
                                        </span>
                                      </td>
                                      <td className="py-3.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${ws.status === 'ACTIVE' ? 'bg-[#22C55E]/10 text-[#22C55E]' : ws.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                                          {ws.status || 'ACTIVE'}
                                        </span>
                                      </td>
                                      <td className="py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {ws.status !== 'ACTIVE' && (
                                            <button
                                              onClick={() => handleUpdateWorkspaceStatus(ws.id, 'ACTIVE')}
                                              className="px-2.5 py-1 rounded-lg bg-[#22C55E] text-white text-[11px] font-bold hover:bg-emerald-600 transition cursor-pointer"
                                            >
                                              Setujui
                                            </button>
                                          )}
                                          {ws.status !== 'SUSPENDED' && (
                                            <button
                                              onClick={() => handleUpdateWorkspaceStatus(ws.id, 'SUSPENDED')}
                                              className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-bold hover:bg-red-500/20 transition cursor-pointer"
                                            >
                                              Suspend
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BLUEPRINTS CATALOG */}
                    {workspaceModuleTab === 'blueprints' && (
                      <div className="clay rounded-[20px] p-6 space-y-4">
                        <h3 className="font-bold text-[18px] text-[var(--text)]">Katalog Blueprint Usaha Perikanan</h3>
                        <p className="text-[13px] text-[var(--text-muted)]">Modul siap pakai yang terkonfigurasi untuk variasi usaha akuakultur.</p>
                        <div className="grid sm:grid-cols-2 gap-4 pt-2">
                          <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[#0EA5E9]/30 space-y-2">
                            <span className="px-2.5 py-1 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-[11px]">Distributor Benih & Pakan</span>
                            <h4 className="font-bold text-[16px] text-[var(--text)]">Distributor Central Blueprint</h4>
                            <p className="text-[12px] text-[var(--text-muted)]">Sistem kasir PO/SJ, stok per cm/ekor, garansi SR kematian benih, dan berita acara.</p>
                          </div>
                          <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[#22C55E]/30 space-y-2">
                            <span className="px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-bold text-[11px]">Pembudidaya Air Tawar</span>
                            <h4 className="font-bold text-[16px] text-[var(--text)]">Tambak Budidaya Blueprint</h4>
                            <p className="text-[12px] text-[var(--text-muted)]">Siklus kolam (DOC), FCR pakan, sampling ABW/SR, kualitas air, dan laba-rugi panen.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BILLING & SUBSCRIPTION */}
                    {workspaceModuleTab === 'billing' && (
                      <div className="space-y-6">
                        <div className="clay rounded-[20px] p-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-[18px] text-[var(--text)]">Profil Billing & Lisensi Platform Master</h3>
                              <p className="text-[13px] text-[var(--text-muted)]">Informasi lisensi cloud, penggunaan kuota sistem, dan konfigurasi paket tenant.</p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[12px] font-bold border border-[#22C55E]/30 shrink-0 self-start sm:self-auto">
                              STATUS LISENSI: AKTIF PERMANEN (ENTERPRISE TIER)
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-1">
                              <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">Kapasitas Tenant Workspace</div>
                              <div className="text-[20px] font-extrabold text-[#0EA5E9]">Unlimited</div>
                              <div className="text-[11px] text-[var(--text-muted)]">Terpakai: {platformWorkspacesList.length} Workspace</div>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-1">
                              <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">Kuota Database Firestore</div>
                              <div className="text-[20px] font-extrabold text-[#22C55E]">10,000,000 / bln</div>
                              <div className="text-[11px] text-[#22C55E] font-medium">Penggunaan: 24% (Normal)</div>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-1">
                              <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">AI Gemini Flash Engine</div>
                              <div className="text-[20px] font-extrabold text-[#F8BF24]">Unlimited</div>
                              <div className="text-[11px] text-[var(--text-muted)]">gemini-3.6-flash Active</div>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-1">
                              <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">PWA Cloud Storage</div>
                              <div className="text-[20px] font-extrabold text-indigo-500">100 GB</div>
                              <div className="text-[11px] text-[var(--text-muted)]">Terpakai: 18.4 GB</div>
                            </div>
                          </div>
                        </div>

                        {/* Rekening Tagihan & Identitas Perusahaan */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="clay rounded-[20px] p-6 space-y-3">
                            <h4 className="font-bold text-[16px] text-[var(--text)]">Entitas Pembayaran & Tagihan Platform</h4>
                            <div className="space-y-2 text-[13px] text-[var(--text-muted)]">
                              <div className="flex justify-between py-1 border-b border-[var(--border)]">
                                <span>Nama Perusahaan:</span>
                                <strong className="text-[var(--text)]">Tumbu Hybrid Business OS</strong>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[var(--border)]">
                                <span>NPWP Perusahaan:</span>
                                <strong className="text-[var(--text)]">31.415.926.5-012.000</strong>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[var(--border)]">
                                <span>Email Billing:</span>
                                <strong className="text-[var(--text)]">billing@tumbu.id</strong>
                              </div>
                              <div className="flex justify-between py-1">
                                <span>Rekening Penampungan BCA:</span>
                                <strong className="text-[#0EA5E9]">8830-1928-1029 (a.n Alfirmansyah)</strong>
                              </div>
                            </div>
                          </div>

                          <div className="clay rounded-[20px] p-6 space-y-3">
                            <h4 className="font-bold text-[16px] text-[var(--text)]">Pengaturan Paket Layanan Member</h4>
                            <p className="text-[12px] text-[var(--text-muted)]">Kelola harga dan fitur paket langganan yang dapat dipilih oleh member.</p>
                            <div className="space-y-2 pt-1">
                              <div className="p-2.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] flex justify-between items-center text-[12px]">
                                <div>
                                  <span className="font-bold text-[var(--text)]">Starter Petani</span>
                                  <div className="text-[11px] text-[var(--text-muted)]">Max 1 Workspace • Rp 149.000/bln</div>
                                </div>
                                <span className="px-2 py-1 rounded bg-[#22C55E]/10 text-[#22C55E] font-bold">AKTIF</span>
                              </div>
                              <div className="p-2.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] flex justify-between items-center text-[12px]">
                                <div>
                                  <span className="font-bold text-[var(--text)]">Growth Usaha</span>
                                  <div className="text-[11px] text-[var(--text-muted)]">Max 3 Workspace • Rp 449.000/bln</div>
                                </div>
                                <span className="px-2 py-1 rounded bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold">POPULAR</span>
                              </div>
                              <div className="p-2.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] flex justify-between items-center text-[12px]">
                                <div>
                                  <span className="font-bold text-[var(--text)]">Kemitraan Scale</span>
                                  <div className="text-[11px] text-[var(--text-muted)]">Unlimited Workspace • Custom Price</div>
                                </div>
                                <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-bold">ENTERPRISE</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Histori Invoice Billing Member */}
                        <div className="clay rounded-[20px] p-6 space-y-4">
                          <h4 className="font-bold text-[16px] text-[var(--text)]">Histori Invoice & Pembayaran Langganan Tenant</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[12px]">
                              <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                                  <th className="pb-3 font-semibold">No Invoice</th>
                                  <th className="pb-3 font-semibold">Tanggal</th>
                                  <th className="pb-3 font-semibold">Workspace Tenant</th>
                                  <th className="pb-3 font-semibold">Paket</th>
                                  <th className="pb-3 font-semibold">Nominal</th>
                                  <th className="pb-3 font-semibold text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                <tr>
                                  <td className="py-3 font-bold text-[#0EA5E9]">INV-2026-08/001</td>
                                  <td className="py-3 text-[var(--text-muted)]">2026-08-01</td>
                                  <td className="py-3 font-bold text-[var(--text)]">Distributor Benih Kediri</td>
                                  <td className="py-3">Growth Usaha</td>
                                  <td className="py-3 font-bold text-[var(--text)]">Rp 449.000</td>
                                  <td className="py-3 text-right"><span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#22C55E]/10 text-[#22C55E]">LUNAS</span></td>
                                </tr>
                                <tr>
                                  <td className="py-3 font-bold text-[#0EA5E9]">INV-2026-08/002</td>
                                  <td className="py-3 text-[var(--text-muted)]">2026-08-05</td>
                                  <td className="py-3 font-bold text-[var(--text)]">Mina Jaya Aquafarm</td>
                                  <td className="py-3">Starter Petani</td>
                                  <td className="py-3 font-bold text-[var(--text)]">Rp 149.000</td>
                                  <td className="py-3 text-right"><span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#22C55E]/10 text-[#22C55E]">LUNAS</span></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SYSTEM SETTINGS & RBAC TEAM MANAGEMENT */}
                    {workspaceModuleTab === 'settings' && (
                      <div className="space-y-6">
                        <div className="clay rounded-[20px] p-6 space-y-4">
                          <h3 className="font-bold text-[18px] text-[var(--text)]">Pengaturan System Master & Status Server</h3>
                          <p className="text-[13px] text-[var(--text-muted)]">Konfigurasi database Cloud Firestore, aturan keamanan rules, dan PWA caching.</p>
                          <div className="grid sm:grid-cols-2 gap-4 pt-1">
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between">
                              <div>
                                <div className="font-bold text-[14px]">Cloud Firestore Provisioning</div>
                                <div className="text-[12px] text-[var(--text-muted)]">Project ID: future-pulsar-tf6jr</div>
                              </div>
                              <span className="px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-bold">CONNECTED</span>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between">
                              <div>
                                <div className="font-bold text-[14px]">Service Worker & Offline PWA</div>
                                <div className="text-[12px] text-[var(--text-muted)]">IndexedDB Local Cache Active</div>
                              </div>
                              <span className="px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-bold">ACTIVE</span>
                            </div>
                          </div>
                        </div>

                        {/* TEAM MANAGEMENT & HAK AKSES ROLE (RBAC) */}
                        <div className="clay rounded-[20px] p-6 space-y-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-[18px] text-[var(--text)]">Manajemen Tim Master & Hak Akses Platform</h3>
                              <p className="text-[13px] text-[var(--text-muted)]">
                                Tambahkan Admin, Teknisi, atau Asisten dengan batasan hak akses sesuai peran masing-masing.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowAddTeamModal(true)}
                              className="px-4 py-2.5 rounded-full bg-[#0EA5E9] text-white text-[13px] font-bold flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shrink-0 self-start sm:self-auto"
                            >
                              <UserCheck className="w-4 h-4" /> Tambah Anggota Tim
                            </button>
                          </div>

                          {/* Matrix Penjelasan Level Akses Role */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-amber-500/30 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                <strong className="text-[13px] text-[var(--text)]">FULL OWNER (Bos/Master)</strong>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                Akses penuh 100% ke seluruh fitur platform, pengeluaran/billing, hapus workspace, dan manajemen tim.
                              </p>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[#0EA5E9]/30 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]" />
                                <strong className="text-[13px] text-[var(--text)]">TEKNISI (Backend Admin)</strong>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                Akses ke AI Sentinel Panel, diagnosa database, keamanan rules, dan log audit.
                                <span className="text-red-500 font-semibold block mt-0.5">Dibatasi dari Billing & Hapus Workspace.</span>
                              </p>
                            </div>
                            <div className="p-4 rounded-[16px] bg-[var(--bg)] border border-[#22C55E]/30 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                                <strong className="text-[13px] text-[var(--text)]">ASISTEN (CS & Operations)</strong>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                Akses ke daftar workspace member, verifikasi pendaftaran, dan katalog blueprint usaha.
                                <span className="text-red-500 font-semibold block mt-0.5">Dibatasi dari Security Audit & Billing.</span>
                              </p>
                            </div>
                          </div>

                          {/* Tabel Anggota Tim Terdaftar */}
                          <div className="overflow-x-auto pt-2">
                            <table className="w-full text-left text-[13px]">
                              <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                                  <th className="pb-3 font-semibold">Nama Anggota</th>
                                  <th className="pb-3 font-semibold">Email Login</th>
                                  <th className="pb-3 font-semibold">Peran / Role</th>
                                  <th className="pb-3 font-semibold">Cakupan Izin Akses</th>
                                  <th className="pb-3 font-semibold text-right">Aksi Admin</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {platformTeamMembers.map((tm) => (
                                  <tr key={tm.id} className="hover:bg-[var(--bg)] transition-colors">
                                    <td className="py-3.5 font-bold text-[var(--text)]">{tm.name}</td>
                                    <td className="py-3.5 text-[var(--text-muted)]">{tm.email}</td>
                                    <td className="py-3.5">
                                      <span
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                          tm.role === 'OWNER'
                                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            : tm.role === 'TEKNISI'
                                            ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] border border-[#0EA5E9]/20'
                                            : 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                                        }`}
                                      >
                                        {tm.role}
                                      </span>
                                    </td>
                                    <td className="py-3.5">
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {tm.permissions.map((p: string) => (
                                          <span key={p} className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]">
                                            {p}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-3.5 text-right">
                                      {tm.role !== 'OWNER' ? (
                                        <button
                                          onClick={() => {
                                            setPlatformTeamMembers(prev => prev.filter(t => t.id !== tm.id));
                                            showToast(`Akses untuk ${tm.name} berhasil dicabut`);
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-bold hover:bg-red-500/20 transition cursor-pointer"
                                        >
                                          Cabut Akses
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-[var(--text-muted)] italic">Owner Utama</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AUDIT TRAIL LOG */}
                    {workspaceModuleTab === 'audit' && (
                      <div className="clay rounded-[20px] p-6 space-y-4">
                        <h3 className="font-bold text-[18px] text-[var(--text)]">Audit Trail & Security Audit Logs</h3>
                        <p className="text-[13px] text-[var(--text-muted)]">Catatan aktivitas penting perubahan status workspace dan login admin.</p>
                        <div className="overflow-x-auto pt-2">
                          <table className="w-full text-left text-[12px]">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                                <th className="pb-3 font-semibold">Waktu Log</th>
                                <th className="pb-3 font-semibold">Pengguna / Admin</th>
                                <th className="pb-3 font-semibold">Aktivitas System</th>
                                <th className="pb-3 font-semibold text-right">Status Response</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              <tr>
                                <td className="py-3 text-[var(--text-muted)]">2026-08-13 03:45:00</td>
                                <td className="py-3 font-bold text-[var(--text)]">Alfirmansyah.sni@gmail.com</td>
                                <td className="py-3 text-[var(--text)]">Login System Master & Provisions Firestore Schema</td>
                                <td className="py-3 text-right font-bold text-[#22C55E]">200 OK</td>
                              </tr>
                              <tr>
                                <td className="py-3 text-[var(--text-muted)]">2026-08-13 03:30:12</td>
                                <td className="py-3 font-bold text-[var(--text)]">System Control Plane</td>
                                <td className="py-3 text-[var(--text)]">Generated PWA Service Worker manifest & logos</td>
                                <td className="py-3 text-right font-bold text-[#22C55E]">200 OK</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </PlatformAdminSkin>
              ) : (
                (() => {
                  const MemberSkin = (view === 'distributor' || activeWorkspace?.productType === 'distributor') ? DistributorSkin : PembudidayaSkin;
                  return (
                    <div className="space-y-6">
                      {/* PEMBATASAN PENDAFTARAN BARU & VERIFIKASI PEMBAYARAN PLATFORM */}
                      {activeWorkspace?.status === 'PENDING' ? (
    <div className="max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500/50 shadow-2xl text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
        <Lock className="w-10 h-10 animate-bounce" />
      </div>
      <div>
        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider">
          Workspace Menunggu ACC Admin
        </span>
        <h2 className="text-2xl font-extrabold text-[var(--text)] mt-3">
          Status Workspace: Belum Lunas / Menunggu Persetujuan
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-2 max-w-lg mx-auto leading-relaxed">
          Pendaftaran workspace <strong>{activeWorkspace?.name}</strong> telah berhasil dikirim. Akses fitur operasional dibatasi sampai konfirmasi pembayaran lisensi diverifikasi dan disetujui (ACC) oleh Admin Platform TUMBU OS.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2 max-w-md mx-auto">
        <div className="flex justify-between font-bold text-[var(--text)]">
          <span>ID Workspace:</span>
          <span className="font-mono text-emerald-600">{activeWorkspace?.id}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Paket Lisensi:</span>
          <span className="font-semibold uppercase">{activeWorkspace?.planId || "Distributor Benih"}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => showToast("Notifikasi konfirmasi pembayaran telah dikirim ke Admin Platform!")}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg transition"
        >
          💳 Konfirmasi Pembayaran Selesai
        </button>
        <button
          type="button"
          onClick={() => window.open("https://wa.me/6281234567890?text=Halo%20Admin%20TUMBU,%20mohon%20ACC%20workspace%20" + encodeURIComponent(activeWorkspace?.name || ""), "_blank")}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
        >
          💬 Hubungi CS / WhatsApp
        </button>
      </div>
    </div>
  ) : (
<MemberSkin
                        workspaceName={activeWorkspace?.name || 'Workspace TUMBU'}
                        workspaceModuleTab={workspaceModuleTab}
                        setWorkspaceModuleTab={setWorkspaceModuleTab}
                        dashboardAiPrompt={dashboardAiPrompt}
                        setDashboardAiPrompt={setDashboardAiPrompt}
                        productsCount={products.length}
                        planId={activeWorkspace?.planId || 'paket_b_juragan'}
                        onOpenAddProductModal={() => setShowHuluHilirModal(true)}
                        onNotify={showToast}
                      >
                  {authToken ? (
                    ['CULTIVATOR', 'BUDIDAYA'].includes((activeWorkspace?.jenisUsaha || '').toUpperCase()) ? (
                      <AquaPages
                        page={workspaceModuleTab}
                        apiFetch={apiFetch}
                        onNotify={showToast}
                        workspaceName={activeWorkspace?.name}
                        blueprintName={activeWorkspace?.blueprint?.name || activeWorkspace?.blueprintName}
                        allowedSpecies={activeWorkspace?.allowedSpecies || []}
                        onNavigate={setWorkspaceModuleTab}
                      />
                    ) : ['SERVICE', 'SERVICE_JASA', 'SERVICE_TEKNISI_PERIKANAN', 'JASA'].includes((activeWorkspace?.jenisUsaha || activeWorkspace?.blueprint?.kind || '').toUpperCase()) || (activeWorkspace?.blueprintId || '').includes('service') ? (
                      <ServicePages
                        page={workspaceModuleTab}
                        apiFetch={apiFetch}
                        onNotify={showToast}
                        blueprintId={activeWorkspace?.blueprintId || activeWorkspace?.blueprint?.id}
                        modules={activeWorkspace?.modules || activeWorkspace?.blueprint?.modules || []}
                        workspaceName={activeWorkspace?.name}
                        workspaceTagline={activeWorkspace?.tagline}
                        workspaceLogoUrl={activeWorkspace?.logoUrl}
                        userName={currentUser?.name || currentUser?.email || authEmail}
                        userRole={activeWorkspace?.role || 'STAFF'}
                      />
                    ) : (
                      <DistributorPages
                        page={workspaceModuleTab}
                        apiFetch={apiFetch}
                        onNotify={showToast}
                      />
                    )
                  ) : (
                    <>
                  {/* DASHBOARD OVERVIEW PANEL */}
                  {workspaceModuleTab === 'dashboard' && (
                <div className="space-y-6 max-w-[1200px]">
                  {['CULTIVATOR', 'BUDIDAYA'].includes((activeWorkspace?.jenisUsaha || '').toUpperCase()) ? (
                    /* BUDIDAYA DASHBOARD KPIs */
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Kolam Aktif</span>
                          <Waves className="w-4 h-4 text-[#22C55E]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {cycles.filter(c => c.state === 'GROWING' || c.state === 'READY').length} Kolam
                        </div>
                        <div className="text-[11px] text-[#22C55E] font-medium">Siklus berjalan aktif</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Total Siklus</span>
                          <Fish className="w-4 h-4 text-[#0EA5E9]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">{cycles.length} Siklus</div>
                        <div className="text-[11px] text-[var(--text-muted)]">Tercatat di backend</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Est. Biomassa Total</span>
                          <Scale className="w-4 h-4 text-[#F8BF24]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {formatNumber(cycles.reduce((acc, c) => acc + parseDecimal(c.biomass), 0))} kg
                        </div>
                        <div className="text-[11px] text-[#22C55E] font-medium">Estimasi pertumbuhan</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Rata-Rata SR (Survival Rate)</span>
                          <Activity className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {cycles.length > 0 ? (cycles.reduce((acc, c) => acc + parseDecimal(c.sr), 0) / cycles.length).toFixed(1) : '0'}%
                        </div>
                        <div className="text-[11px] text-emerald-500 font-medium">Monitoring tingkat kelangsungan</div>
                      </div>
                    </div>
                  ) : (
                    /* DISTRIBUTOR DASHBOARD KPIs - NO "Kolam Aktif"! REAL DATA ONLY! */
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Stok Total</span>
                          <Package className="w-4 h-4 text-[#0EA5E9]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {formatNumber(products.reduce((acc, p) => acc + parseDecimal(p.stock), 0))} unit
                        </div>
                        <div className="text-[11px] text-[#0EA5E9] font-medium">{products.length} SKU terdaftar</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Produk / SKU Aktif</span>
                          <Boxes className="w-4 h-4 text-[#22C55E]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">{products.length} SKU</div>
                        <div className="text-[11px] text-[var(--text-muted)]">Katalog master aktif</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Kas Hari Ini</span>
                          <DollarSign className="w-4 h-4 text-[#F8BF24]" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {formatRupiah(salesTransactions.filter(t => t.paymentStatus === 'LUNAS').reduce((acc, t) => acc + t.totalPrice, 0))}
                        </div>
                        <div className="text-[11px] text-[#22C55E] font-medium">Total penerimaan LUNAS</div>
                      </div>

                      <div className="clay rounded-[18px] p-5 space-y-2">
                        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                          <span>Piutang Belum Lunas</span>
                          <BarChart3 className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-[22px] font-bold text-[var(--text)]">
                          {formatRupiah(salesTransactions.filter(t => t.paymentStatus === 'TEMPO').reduce((acc, t) => acc + t.totalPrice, 0))}
                        </div>
                        <div className="text-[11px] text-amber-500 font-medium">
                          {salesTransactions.filter(t => t.paymentStatus === 'TEMPO').length} transaksi TEMPO
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Bar for Transactions & Master Data */}
                  <div className="clay rounded-[20px] p-5 flex flex-wrap items-center justify-between gap-4 border border-[var(--border)]">
                    <div>
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Aksi Cepat Transaksi</h3>
                      <p className="text-[12px] text-[var(--text-muted)]">Pilih modul operasional untuk membuka riwayat transaksi atau membuat transaksi baru.</p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowQuickActionsDropdown(!showQuickActionsDropdown)}
                        className="h-10 px-5 rounded-full bg-[#0EA5E9] text-white font-bold text-[12px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer border-0"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Aksi Cepat Menu</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {showQuickActionsDropdown && (
                        <>
                          {/* Invisible backdrop to close the dropdown on outer click */}
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setShowQuickActionsDropdown(false)} 
                          />
                          <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl z-40 py-1 overflow-hidden">
                            <button
                              onClick={() => {
                                setWorkspaceModuleTab('sales');
                                setShowAddSaleModal(true);
                                setShowQuickActionsDropdown(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition flex items-center gap-2 border-0 bg-transparent cursor-pointer"
                            >
                              <FileText className="w-4 h-4 text-[#0EA5E9]" />
                              <span>+ Penjualan Baru</span>
                            </button>
                            <button
                              onClick={() => {
                                setWorkspaceModuleTab('purchase');
                                showToast('Buka Modul Pembelian');
                                setShowQuickActionsDropdown(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition flex items-center gap-2 border-0 bg-transparent cursor-pointer"
                            >
                              <Boxes className="w-4 h-4 text-emerald-500" />
                              <span>+ Pembelian Baru</span>
                            </button>
                            <div className="border-t border-[var(--border)] my-1" />
                            <button
                              onClick={() => {
                                setWorkspaceModuleTab('master');
                                showToast('Buka Master Data');
                                setShowQuickActionsDropdown(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition flex items-center gap-2 border-0 bg-transparent cursor-pointer"
                            >
                              <Layers className="w-4 h-4" />
                              <span>Buka Master Data</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stock / Cycle Data Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Stok & Inventori Usaha</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">Nama Item / Ukuran</th>
                            <th className="pb-3 font-semibold">Kategori</th>
                            <th className="pb-3 font-semibold">Jumlah Stok</th>
                            <th className="pb-3 font-semibold">Harga Satuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {products.length > 0 ? (
                            products.map((p, idx) => (
                              <tr key={idx} className="hover:bg-[var(--bg)]">
                                <td className="py-3 font-medium text-[var(--text)]">{p.size}</td>
                                <td className="py-3 text-[var(--text-muted)]">{p.commodityCategory}</td>
                                <td className="py-3 font-bold text-[#22C55E]">{formatNumber(p.stock)} {p.unit}</td>
                                <td className="py-3 font-medium">{formatRupiah(p.price)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-[var(--text-muted)]">
                                Belum ada data stok. Silakan tambah item di atas.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: PENJUALAN (INVOICE) */}
              {workspaceModuleTab === 'sales' && (
                <div className="space-y-6 max-w-[1200px]">
                  {/* Summary & Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[20px] text-[var(--text)]">Penjualan (Invoice)</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Catat transaksi penjualan benih & pakan, kelola invoice tagihan, dan pantau piutang pelanggan.</p>
                    </div>
                    <button
                      onClick={() => setShowAddSaleModal(true)}
                      className="h-11 px-5 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md self-start sm:self-auto"
                    >
                      <FileText className="w-4 h-4" /> + Tambah Penjualan Baru
                    </button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Total Pemasukan Penjualan</div>
                      <div className="text-[22px] font-extrabold text-[#22C55E]">
                        {formatRupiah(salesTransactions.reduce((acc, t) => acc + t.totalPrice, 0))}
                      </div>
                      <div className="text-[11px] text-[#22C55E] font-medium">{salesTransactions.length} Invoice Terbit</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Piutang Pelanggan (Tempo)</div>
                      <div className="text-[22px] font-extrabold text-amber-500">
                        {formatRupiah(salesTransactions.filter(t => t.paymentStatus === 'TEMPO').reduce((acc, t) => acc + t.totalPrice, 0))}
                      </div>
                      <div className="text-[11px] text-amber-500 font-medium">
                        {salesTransactions.filter(t => t.paymentStatus === 'TEMPO').length} invoice belum lunas
                      </div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Terintegrasi Rantai Pasok</div>
                      <div className="text-[22px] font-extrabold text-[#0EA5E9]">
                        {salesTransactions.filter(t => t.connectedSupplyChain).length} Transaksi
                      </div>
                      <div className="text-[11px] text-[#0EA5E9] font-medium">Otomatis sync ke modal awal kolam</div>
                    </div>
                  </div>

                  {/* Sales Invoice Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Invoice Penjualan</h3>
                      <button
                        onClick={() => setShowHuluHilirModal(true)}
                        className="text-[12px] font-bold text-[#0EA5E9] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Review Rantai Pasok Hulu-Hilir
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">No. Invoice</th>
                            <th className="pb-3 font-semibold">Tanggal</th>
                            <th className="pb-3 font-semibold">Pelanggan / Pembudidaya</th>
                            <th className="pb-3 font-semibold">Item & Ukuran</th>
                            <th className="pb-3 font-semibold">Jumlah</th>
                            <th className="pb-3 font-semibold">Harga Satuan</th>
                            <th className="pb-3 font-semibold">Total Nilai (Rp)</th>
                            <th className="pb-3 font-semibold">Status Bayar</th>
                            <th className="pb-3 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {salesTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada transaksi penjualan. Klik tombol "+ Transaksi Baru" untuk mencatat penjualan benih atau pakan.
                              </td>
                            </tr>
                          ) : (
                            salesTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-[var(--bg)] transition-colors">
                              <td className="py-3.5 font-bold text-[#0EA5E9]">INV-{tx.sjNumber.replace('SJ-', '')}</td>
                              <td className="py-3.5 text-[var(--text-muted)]">{tx.date}</td>
                              <td className="py-3.5 font-semibold text-[var(--text)]">
                                {tx.customerName}
                                {tx.connectedSupplyChain && (
                                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] text-[10px] font-bold">
                                    <Link2 className="w-3 h-3" /> Hulu-Hilir
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 text-[var(--text)]">{tx.itemName}</td>
                              <td className="py-3.5 font-medium">{formatNumber(tx.quantity)} {tx.unit}</td>
                              <td className="py-3.5 font-medium">{formatRupiah(tx.unitPrice)}</td>
                              <td className="py-3.5 font-extrabold text-[#22C55E]">{formatRupiah(tx.totalPrice)}</td>
                              <td className="py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${tx.paymentStatus === 'LUNAS' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {tx.paymentStatus === 'LUNAS' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                  {tx.paymentStatus}
                                </span>
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => setSelectedInvoice(tx)}
                                  className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:bg-[#0EA5E9] hover:text-white text-[12px] font-bold transition cursor-pointer"
                                >
                                  Cetak Invoice
                                </button>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: SURAT JALAN (LOGISTIK PENGIRIMAN TANPA HARGA / RUPIAH) */}
              {workspaceModuleTab === 'suratjalan' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[22px] text-[var(--text)]">Surat Jalan Pengiriman Ikan</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                        Dokumen logistik pengiriman ikan ke penerima/pembudidaya. Berisi rincian armada & koli pengiriman (tanpa harga / nilai rupiah).
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddSjModal(true)}
                      className="h-11 px-5 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md self-start sm:self-auto"
                    >
                      <Truck className="w-4 h-4" /> + Surat Jalan Baru
                    </button>
                  </div>

                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Surat Jalan Terbit</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">No. Surat Jalan</th>
                            <th className="pb-3 font-semibold">Tanggal Kirim</th>
                            <th className="pb-3 font-semibold">Penerima & Alamat</th>
                            <th className="pb-3 font-semibold">Armada & Driver</th>
                            <th className="pb-3 font-semibold">Item Komoditas</th>
                            <th className="pb-3 font-semibold">Koli / Box</th>
                            <th className="pb-3 font-semibold">Total Ekor</th>
                            <th className="pb-3 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {suratJalanList.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada Surat Jalan pengiriman. Klik tombol "+ Surat Jalan Baru" untuk menerbitkan dokumen pengiriman.
                              </td>
                            </tr>
                          ) : (
                            suratJalanList.map((sj) => (
                            <tr key={sj.id} className="hover:bg-[var(--bg)] transition-colors">
                              <td className="py-3.5 font-bold text-[#0EA5E9]">{sj.sjNumber}</td>
                              <td className="py-3.5 text-[var(--text-muted)]">{sj.date}</td>
                              <td className="py-3.5 font-semibold text-[var(--text)]">
                                <div>{sj.recipient}</div>
                                <div className="text-[11px] text-[var(--text-muted)] font-normal">{sj.address}</div>
                              </td>
                              <td className="py-3.5 text-[var(--text)]">
                                <div>{sj.driverName}</div>
                                <div className="text-[11px] text-[#0EA5E9] font-bold">{sj.vehiclePlate}</div>
                              </td>
                              <td className="py-3.5 text-[var(--text)] font-medium">{sj.itemName}</td>
                              <td className="py-3.5 font-bold text-[var(--text)]">{sj.totalKoli}</td>
                              <td className="py-3.5 font-bold text-[#22C55E]">{sj.totalEkor > 0 ? `${formatNumber(sj.totalEkor)} ekor` : '-'}</td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => showToast(`Mencetak Surat Jalan Pengiriman ${sj.sjNumber} (Tanpa Harga)`)}
                                  className="px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-[11px] font-bold hover:bg-slate-800 transition cursor-pointer"
                                >
                                  Cetak Surat Jalan
                                </button>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: BERITA ACARA (BA) SERAH TERIMA PEMBELIAN IKAN */}
              {workspaceModuleTab === 'beritaacara' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[22px] text-[var(--text)]">Berita Acara</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                        Pencatatan serah terima pembelian ikan dari Petani ke Distributor. Terdiri dari rincian sekatan per bak, hitungan ulang, dan tombol Import langsung ke Purchase Order (PO).
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddBaModal(true)}
                      className="h-11 px-5 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md self-start sm:self-auto"
                    >
                      <FileCheck className="w-4 h-4" /> + Buat BA Baru
                    </button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Total Berita Acara</div>
                      <div className="text-[22px] font-extrabold text-[var(--text)]">
                        {beritaAcaraList.length} Dokumen BA
                      </div>
                      <div className="text-[11px] text-[#0EA5E9] font-medium">Berdasarkan penghitungan sekatan bak</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Siap Import ke Purchase Order</div>
                      <div className="text-[22px] font-extrabold text-amber-500">
                        {beritaAcaraList.filter(b => b.statusImport === 'BELUM_IMPORT').length} BA Pending
                      </div>
                      <div className="text-[11px] text-amber-500 font-medium">Belum dimasukkan ke pengeluaran PO</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Sudah Diimport ke PO Pembelian</div>
                      <div className="text-[22px] font-extrabold text-[#22C55E]">
                        {beritaAcaraList.filter(b => b.statusImport === 'DIIMPORT_PO').length} BA Terimport
                      </div>
                      <div className="text-[11px] text-[#22C55E] font-medium">Kuantitas hasil hitung ulang masuk PO</div>
                    </div>
                  </div>

                  {/* BA Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Berita Acara</h3>
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {(['ALL', 'BELUM_IMPORT', 'DIIMPORT_PO'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setBaFilter(filter)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition shrink-0 ${
                              baFilter === filter
                                ? 'bg-[#0EA5E9] text-white'
                                : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                          >
                            {filter === 'ALL' ? 'Semua Status' : filter === 'BELUM_IMPORT' ? 'Belum Import PO' : 'Sudah Import PO'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">No. Dokumen BA</th>
                            <th className="pb-3 font-semibold">Tanggal</th>
                            <th className="pb-3 font-semibold">Petani Penjual</th>
                            <th className="pb-3 font-semibold">Item & Ukuran</th>
                            <th className="pb-3 font-semibold">Hitungan Awal</th>
                            <th className="pb-3 font-semibold">Hitung Aktual</th>
                            <th className="pb-3 font-semibold">Susut / Selisih</th>
                            <th className="pb-3 font-semibold">Status PO</th>
                            <th className="pb-3 font-semibold text-right min-w-[200px]">Aksi Dokumen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {beritaAcaraList.filter(ba => baFilter === 'ALL' || ba.statusImport === baFilter).length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada dokumen Berita Acara. Klik tombol "+ Buat BA Baru" untuk mencatat serah terima sekatan ikan.
                              </td>
                            </tr>
                          ) : (
                            beritaAcaraList
                            .filter(ba => baFilter === 'ALL' || ba.statusImport === baFilter)
                            .map((ba) => (
                              <tr key={ba.id} className="hover:bg-[var(--bg)] transition-colors">
                                <td className="py-3.5 font-bold text-[#0EA5E9]">{ba.number}</td>
                                <td className="py-3.5 text-[var(--text-muted)]">{ba.date}</td>
                                <td className="py-3.5 font-semibold text-[var(--text)]">{ba.petani}</td>
                                <td className="py-3.5 text-[var(--text)]">{ba.item}</td>
                                <td className="py-3.5 font-medium">{formatNumber(ba.totalAwalPetani)} ekor</td>
                                <td className="py-3.5 font-bold text-[#22C55E]">{formatNumber(ba.totalUlangDistributor)} ekor</td>
                                <td className="py-3.5 font-semibold text-amber-500">-{formatNumber(ba.susutEkor)} ekor</td>
                                <td className="py-3.5">
                                  {ba.statusImport === 'DIIMPORT_PO' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#22C55E]/10 text-[#22C55E]">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Terimport ({ba.importedPoNumber})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Pending Import
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 text-right space-x-2">
                                  {ba.statusImport === 'BELUM_IMPORT' && (
                                    <button
                                      onClick={() => {
                                        // Import into Purchase Order
                                        const newPoNumber = `PO-2026-00${purchasesList.length + 1}`;
                                        const importedPo = {
                                          id: `pur-${Date.now()}`,
                                          poNumber: newPoNumber,
                                          date: new Date().toISOString().split('T')[0],
                                          supplierName: ba.petani,
                                          itemName: ba.item,
                                          quantity: ba.totalUlangDistributor,
                                          unit: 'ekor',
                                          unitPrice: 150,
                                          totalPrice: ba.totalUlangDistributor * 150,
                                          paymentStatus: 'TEMPO',
                                          notes: `Di-import otomatis dari Berita Acara ${ba.number}`,
                                        };
                                        const updatedPurchases = [importedPo, ...purchasesList];
                                        setPurchasesList(updatedPurchases);
                                        try {
                                          localStorage.setItem('tumbu-purchases', JSON.stringify(updatedPurchases));
                                        } catch {}

                                        const updatedBa = beritaAcaraList.map(b => b.id === ba.id ? { ...b, statusImport: 'DIIMPORT_PO', importedPoNumber: newPoNumber } : b);
                                        setBeritaAcaraList(updatedBa);
                                        try {
                                          localStorage.setItem('tumbu-ba', JSON.stringify(updatedBa));
                                        } catch {}

                                        showToast(`Berhasil di-import ke PO ${newPoNumber} (${formatNumber(ba.totalUlangDistributor)} ekor)!`);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white text-[11px] font-bold hover:bg-[#0284C7] transition cursor-pointer border-0 shadow-xs"
                                    >
                                      + Import ke PO
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedBaForPrint(ba)}
                                    className="px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-[11px] font-bold hover:bg-slate-800 transition cursor-pointer border-0 shadow-xs inline-flex items-center gap-1.5"
                                  >
                                    <Printer className="w-3.5 h-3.5" /> Cetak PDF BA
                                  </button>
                                </td>
                              </tr>
                            )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: TUTUP BUKU & CLOSING PERIODE */}
              {workspaceModuleTab === 'tutupbuku' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[22px] text-[var(--text)]">Tutup Buku & Closing Periode</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                        Kunci transaksi bulanan, hitung saldo akhir stok & kas, dan terbitkan Laporan Laba-Rugi resmi periode berjalan.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPreviewClosingModal(true)}
                      className="h-11 px-5 rounded-full bg-purple-600 text-white font-bold text-[13px] flex items-center gap-2 hover:bg-purple-700 transition cursor-pointer shadow-md self-start sm:self-auto"
                    >
                      <Lock className="w-4 h-4" /> Preview & Closing Periode Ini
                    </button>
                  </div>

                  {/* Closing Status KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Periode Aktif Berjalan</div>
                      <div className="text-[22px] font-extrabold text-[#0EA5E9]">{closingPeriodYm}</div>
                      <div className="text-[11px] text-[#0EA5E9] font-medium">Status: TERBUKA (Dalam Pencatatan)</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Estimasi Omset Periode Ini</div>
                      <div className="text-[22px] font-extrabold text-[#22C55E]">
                        {formatRupiah(salesTransactions.reduce((acc, t) => acc + t.totalPrice, 0))}
                      </div>
                      <div className="text-[11px] text-[#22C55E] font-medium">Berdasarkan total transaksi SJ</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Estimasi Laba Bersih</div>
                      <div className="text-[22px] font-extrabold text-purple-600 dark:text-purple-400">
                        {formatRupiah(
                          salesTransactions.reduce((acc, t) => acc + t.totalPrice, 0) -
                          expensesList.reduce((acc, x) => acc + parseDecimal(x.amount), 0)
                        )}
                      </div>
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Omset dikurangi Pengeluaran</div>
                    </div>
                  </div>

                  {/* Closing History Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <h3 className="font-bold text-[16px] text-[var(--text)]">Riwayat Tutup Buku Resmi (Locked Periods)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">Periode Bulan</th>
                            <th className="pb-3 font-semibold">Tanggal Ditutup</th>
                            <th className="pb-3 font-semibold">Total Pendapatan</th>
                            <th className="pb-3 font-semibold">Total Pengeluaran</th>
                            <th className="pb-3 font-semibold">Laba Netto</th>
                            <th className="pb-3 font-semibold">Status Lock</th>
                            <th className="pb-3 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {closingHistory.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada riwayat tutup buku resmi. Klik "Preview & Closing Periode Ini" di akhir bulan untuk mengunci periode keuangan.
                              </td>
                            </tr>
                          ) : (
                            closingHistory.map((cl) => (
                            <tr key={cl.periodYm} className="hover:bg-[var(--bg)] transition-colors">
                              <td className="py-3.5 font-extrabold text-[var(--text)]">{cl.periodYm}</td>
                              <td className="py-3.5 text-[var(--text-muted)]">{cl.closedDate}</td>
                              <td className="py-3.5 font-bold text-[#22C55E]">{formatRupiah(cl.revenue)}</td>
                              <td className="py-3.5 font-bold text-red-500">{formatRupiah(cl.expense)}</td>
                              <td className="py-3.5 font-extrabold text-purple-600 dark:text-purple-400">{formatRupiah(cl.netProfit)}</td>
                              <td className="py-3.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500">
                                  <Lock className="w-3 h-3" /> LOCKED & VERIFIED
                                </span>
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  onClick={() => showToast(`Mengunduh Laporan Laba Rugi Tutup Buku ${cl.periodYm}`)}
                                  className="px-3 py-1.5 rounded-full bg-[#0F172A] dark:bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-800 transition cursor-pointer"
                                >
                                  Cetak Laporan PDF
                                </button>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {(workspaceModuleTab === 'purchase' || workspaceModuleTab === 'pembelian') && (
                <div className="space-y-6 max-w-[1200px]">
                  {/* Summary & Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[20px] text-[var(--text)]">Purchase Order (PO) Pembelian</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Catat pengeluaran pembelian stok benih & pakan dari Petani, Balai Benih, Hatchery, dan Supplier.</p>
                    </div>
                    <button
                      onClick={() => setShowAddPurchaseModal(true)}
                      className="h-11 px-5 rounded-full bg-[#0F172A] dark:bg-slate-800 text-white font-bold text-[13px] flex items-center gap-2 hover:bg-slate-800 transition cursor-pointer shadow-md self-start sm:self-auto"
                    >
                      <Boxes className="w-4 h-4 text-[#0EA5E9]" /> + Tambah Purchase Order (PO)
                    </button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Total Pengeluaran Pembelian Stok</div>
                      <div className="text-[22px] font-extrabold text-rose-600 dark:text-rose-400">
                        {formatRupiah(purchasesList.reduce((acc, p) => acc + parseDecimal(p.totalPrice || 0), 0))}
                      </div>
                      <div className="text-[11px] text-[#22C55E] font-medium">{purchasesList.length} Purchase Order Terbit</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Hutang Supplier / Petani (Tempo)</div>
                      <div className="text-[22px] font-extrabold text-amber-500">
                        {formatRupiah(purchasesList.filter(p => p.paymentStatus === 'TEMPO').reduce((acc, p) => acc + parseDecimal(p.totalPrice || 0), 0))}
                      </div>
                      <div className="text-[11px] text-amber-500 font-medium">
                        {purchasesList.filter(p => p.paymentStatus === 'TEMPO').length} PO belum lunas
                      </div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">Pembelian Lunas</div>
                      <div className="text-[22px] font-extrabold text-[#22C55E]">
                        {formatRupiah(purchasesList.filter(p => p.paymentStatus === 'LUNAS').reduce((acc, p) => acc + parseDecimal(p.totalPrice || 0), 0))}
                      </div>
                      <div className="text-[11px] text-[#22C55E] font-medium">Lunas terverifikasi</div>
                    </div>
                  </div>

                  {/* Purchases Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Purchase Order (PO) Pembelian</h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">No. PO</th>
                            <th className="pb-3 font-semibold">Tanggal</th>
                            <th className="pb-3 font-semibold">Supplier / Petani Penjual</th>
                            <th className="pb-3 font-semibold">Item & Ukuran</th>
                            <th className="pb-3 font-semibold">Jumlah (Ekor/Unit)</th>
                            <th className="pb-3 font-semibold">Total Pengeluaran (Rp)</th>
                            <th className="pb-3 font-semibold">Status Bayar</th>
                            <th className="pb-3 font-semibold text-right">Catatan / Ref BA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {purchasesList.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada Purchase Order (PO) Pembelian. Klik tombol "+ Tambah Purchase Order (PO)" untuk mencatat pengeluaran stok.
                              </td>
                            </tr>
                          ) : (
                            purchasesList.map((po) => (
                            <tr key={po.id} className="hover:bg-[var(--bg)] transition-colors">
                              <td className="py-3.5 font-bold text-[#0EA5E9]">{po.poNumber}</td>
                              <td className="py-3.5 text-[var(--text-muted)]">{po.date}</td>
                              <td className="py-3.5 font-semibold text-[var(--text)]">{po.supplierName}</td>
                              <td className="py-3.5 text-[var(--text)]">{po.itemName}</td>
                              <td className="py-3.5 font-medium">{formatNumber(po.quantity)} {po.unit}</td>
                              <td className="py-3.5 font-extrabold text-rose-600 dark:text-rose-400">{formatRupiah(po.totalPrice)}</td>
                              <td className="py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${po.paymentStatus === 'LUNAS' ? 'bg-[#22C55E]/10 text-[#22C55E]' : po.paymentStatus === 'TEMPO' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                  {po.paymentStatus === 'LUNAS' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                  {po.paymentStatus}
                                </span>
                              </td>
                              <td className="py-3.5 text-right text-[12px] text-[var(--text-muted)]">{po.notes || '-'}</td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: REVIEW RANTAI PASOK HULU-HILIR */}
              {workspaceModuleTab === 'integrasi_pasok' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="clay rounded-[24px] p-6 sm:p-8 space-y-4 bg-gradient-to-r from-[#0EA5E9]/10 via-[#22C55E]/10 to-transparent border border-[var(--border)]">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0EA5E9] text-white text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#F8BF24]" /> Kemitraan Terintegrasi
                    </div>
                    <h2 className="font-extrabold text-[22px] sm:text-[26px] text-[var(--text)]">Jurnal Rantai Pasok Hulu ke Hilir</h2>
                    <p className="text-[14px] text-[var(--text-muted)] max-w-[750px] leading-relaxed">
                      Hubungkan transaksi antara Distributor Benih/Pakan dengan Pembudidaya Air Tawar. Nota benih dari distributor otomatis dicatat sebagai Modal Awal Siklus Kolam Pembudidaya, menciptakan transparansi 100%.
                    </p>
                    <div className="pt-2 flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowAddSaleModal(true)}
                        className="h-11 px-5 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md"
                      >
                        <FileText className="w-4 h-4" /> + Transaksi Kemitraan Baru
                      </button>
                    </div>
                  </div>

                  {/* Connected Supply Chain Flow Diagram */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[20px] p-5 space-y-2 border-l-4 border-l-[#0EA5E9]">
                      <div className="text-[11px] font-bold text-[#0EA5E9] uppercase tracking-wider">Langkah 1: Hulu</div>
                      <h4 className="font-bold text-[15px] text-[var(--text)]">Distributor & Hatchery</h4>
                      <p className="text-[12px] text-[var(--text-muted)]">Menerbitkan Surat Jalan (SJ) Benih/Pakan resmi & mencatat status pembayaran lunas/tempo.</p>
                    </div>

                    <div className="clay rounded-[20px] p-5 space-y-2 border-l-4 border-l-[#F8BF24]">
                      <div className="text-[11px] font-bold text-[#F8BF24] uppercase tracking-wider">Langkah 2: Integrasi</div>
                      <h4 className="font-bold text-[15px] text-[var(--text)]">Sync Modal Kolam</h4>
                      <p className="text-[12px] text-[var(--text-muted)]">Nilai transaksi otomatis masuk ke Biaya Operasional (BOP) kolam pembudidaya.</p>
                    </div>

                    <div className="clay rounded-[20px] p-5 space-y-2 border-l-4 border-l-[#22C55E]">
                      <div className="text-[11px] font-bold text-[#22C55E] uppercase tracking-wider">Langkah 3: Hilir</div>
                      <h4 className="font-bold text-[15px] text-[var(--text)]">Offtake & Buyback Panen</h4>
                      <p className="text-[12px] text-[var(--text-muted)]">Hasil panen dibeli distributor dengan potongan hutang benih secara transparan.</p>
                    </div>
                  </div>

                  {/* Connected Transactions Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4">
                    <h3 className="font-bold text-[16px] text-[var(--text)]">Review Transaksi Terhubung Antar Mitra</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">Surat Jalan</th>
                            <th className="pb-3 font-semibold">Distributor Penjual</th>
                            <th className="pb-3 font-semibold">Pembudidaya Pembeli</th>
                            <th className="pb-3 font-semibold">Komoditas / Size</th>
                            <th className="pb-3 font-semibold">Kolam Tujuan</th>
                            <th className="pb-3 font-semibold">Total Nilai</th>
                            <th className="pb-3 font-semibold">Status Sync</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {salesTransactions.filter(t => t.connectedSupplyChain).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-[var(--text-muted)] text-[13px]">
                                Belum ada transaksi kemitraan hulu-hilir terhubung. Transaksi Surat Jalan yang ditautkan ke akun Pembudidaya akan otomatis muncul di sini.
                              </td>
                            </tr>
                          ) : (
                            salesTransactions.filter(t => t.connectedSupplyChain).map((tx) => (
                            <tr key={tx.id} className="hover:bg-[var(--bg)] transition-colors">
                              <td className="py-3.5 font-bold text-[#0EA5E9]">{tx.sjNumber}</td>
                              <td className="py-3.5 font-semibold text-[var(--text)]">TUMBU Distributor Central</td>
                              <td className="py-3.5 font-semibold text-[var(--text)]">{tx.customerName}</td>
                              <td className="py-3.5 text-[var(--text)]">{tx.itemName} ({formatNumber(tx.quantity)} {tx.unit})</td>
                              <td className="py-3.5 font-medium text-[#22C55E]">{tx.pondDestination || 'Kolam Utama'}</td>
                              <td className="py-3.5 font-extrabold text-[var(--text)]">{formatRupiah(tx.totalPrice)}</td>
                              <td className="py-3.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi Sync
                                </span>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: PENGELUARAN OPERASIONAL & SIKLUS */}
              {workspaceModuleTab === 'expense' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-bold text-[var(--text)]">Pencatatan Pengeluaran Operasional</h2>
                      <p className="text-[13px] text-[var(--text-muted)]">Klasifikasi pengeluaran sesuai standar distributor perikanan & budidaya</p>
                    </div>
                    <div className="clay px-4 py-2 rounded-xl border border-[var(--border)] text-right">
                      <div className="text-[11px] text-[var(--text-muted)] font-semibold">Total Pengeluaran</div>
                      <div className="text-[18px] font-extrabold text-red-500">
                        {formatRupiah(expensesList.reduce((acc, x) => acc + parseDecimal(x.amount), 0))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Add Expense Form */}
                    <div className="clay rounded-[20px] p-5 space-y-4 border border-[var(--border)] h-fit">
                      <div className="flex items-center gap-2 font-bold text-[15px] text-[var(--text)]">
                        <DollarSign className="w-4 h-4 text-red-500" />
                        <span>Catat Pengeluaran Baru</span>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!expAmount || parseDecimal(expAmount) <= 0) {
                            showToast('Jumlah pengeluaran harus lebih dari 0');
                            return;
                          }
                          const newExp = {
                            id: `exp-${Date.now()}`,
                            date: new Date().toISOString().split('T')[0],
                            category: expCategory,
                            amount: parseDecimal(expAmount),
                            description: expDesc || expCategory,
                            account: expAccount,
                          };
                          setExpensesList([newExp, ...expensesList]);
                          // Also record to cash entries if cash
                          setCashEntriesList([
                            {
                              id: `cash-${Date.now()}`,
                              date: newExp.date,
                              category: newExp.category,
                              amount: newExp.amount,
                              direction: 'OUT',
                              account: newExp.account,
                              description: newExp.description,
                            },
                            ...cashEntriesList,
                          ]);
                          setExpAmount('');
                          setExpDesc('');
                          showToast('Pengeluaran berhasil dicatat');
                        }}
                        className="space-y-3 text-[13px]"
                      >
                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Kategori Pengeluaran</label>
                          <select
                            value={expCategory}
                            onChange={(e) => setExpCategory(e.target.value)}
                            className="w-full h-10 px-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          >
                            <option value="Operasional Kasir / Kantor">Operasional Kasir / Kantor</option>
                            <option value="Transportasi & BBM Armada">Transportasi & BBM Armada</option>
                            <option value="Gaji & Upah Borongan">Gaji & Upah Borongan</option>
                            <option value="Listrik, Pompa & Air">Listrik, Pompa & Air</option>
                            <option value="Perawatan Kolam & Bak">Perawatan Kolam & Bak Penampungan</option>
                            <option value="Pakan Tambahan / Aklimatisasi">Pakan Tambahan / Aklimatisasi</option>
                            <option value="Obat, Vitamin & Garam">Obat, Vitamin & Garam Ikan</option>
                            <option value="Perlengkapan Packing">Perlengkapan Packing (Oksigen, Plastik)</option>
                            <option value="Lain-lain">Lain-lain</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Jumlah Biaya (Rp)</label>
                          <input
                            type="number"
                            placeholder="Contoh: 350000"
                            value={expAmount}
                            onChange={(e) => setExpAmount(e.target.value)}
                            className="w-full h-10 px-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Sumber Dana / Akun</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setExpAccount('CASH')}
                              className={`h-9 rounded-[10px] font-bold text-[12px] cursor-pointer border ${expAccount === 'CASH' ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]' : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]'}`}
                            >
                              Kas Tunai
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpAccount('BANK')}
                              className={`h-9 rounded-[10px] font-bold text-[12px] cursor-pointer border ${expAccount === 'BANK' ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]' : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]'}`}
                            >
                              Rekening Bank
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Keterangan / Rincian</label>
                          <input
                            type="text"
                            placeholder="BBM Pickup, Pembelian Oksigen, dll"
                            value={expDesc}
                            onChange={(e) => setExpDesc(e.target.value)}
                            className="w-full h-10 px-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full h-11 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-[13px] transition cursor-pointer shadow-md mt-1"
                        >
                          + Simpan Pengeluaran
                        </button>
                      </form>
                    </div>

                    {/* Expense History Table */}
                    <div className="lg:col-span-2 clay rounded-[20px] p-5 space-y-4 border border-[var(--border)]">
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Riwayat Pengeluaran Operasional</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                              <th className="pb-3 font-semibold">Tanggal</th>
                              <th className="pb-3 font-semibold">Kategori</th>
                              <th className="pb-3 font-semibold">Keterangan</th>
                              <th className="pb-3 font-semibold">Akun</th>
                              <th className="pb-3 font-semibold text-right">Jumlah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {expensesList.map((exp) => (
                              <tr key={exp.id} className="hover:bg-[var(--bg)]">
                                <td className="py-3 text-[var(--text-muted)]">{exp.date}</td>
                                <td className="py-3 font-semibold text-[var(--text)]">{exp.category}</td>
                                <td className="py-3 text-[var(--text-muted)]">{exp.description}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${exp.account === 'CASH' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#0EA5E9]/10 text-[#0EA5E9]'}`}>
                                    {exp.account === 'CASH' ? 'TUNAI' : 'BANK'}
                                  </span>
                                </td>
                                <td className="py-3 font-bold text-red-500 text-right">{formatRupiah(exp.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: KAS & BANK MANAGEMENT */}
              {workspaceModuleTab === 'cash' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-bold text-[var(--text)]">Pengelolaan Kas & Bank</h2>
                      <p className="text-[13px] text-[var(--text-muted)]">Pemisahan saldo kas tunai dan rekening transfer bank</p>
                    </div>
                  </div>

                  {/* Cash KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="clay rounded-[18px] p-5 space-y-1 border border-[var(--border)]">
                      <div className="text-[12px] text-[var(--text-muted)]">Saldo Kas Tunai (Fisik)</div>
                      <div className="text-[22px] font-extrabold text-[#22C55E]">
                        {formatRupiah(
                          cashEntriesList
                            .filter(c => c.account === 'CASH')
                            .reduce((acc, c) => acc + (c.direction === 'IN' ? parseDecimal(c.amount) : -parseDecimal(c.amount)), 8500000)
                        )}
                      </div>
                      <div className="text-[11px] text-[#22C55E]">Siap untuk operasional harian</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1 border border-[var(--border)]">
                      <div className="text-[12px] text-[var(--text-muted)]">Saldo Rekening Bank</div>
                      <div className="text-[22px] font-extrabold text-[#0EA5E9]">
                        {formatRupiah(
                          cashEntriesList
                            .filter(c => c.account === 'BANK')
                            .reduce((acc, c) => acc + (c.direction === 'IN' ? parseDecimal(c.amount) : -parseDecimal(c.amount)), 45000000)
                        )}
                      </div>
                      <div className="text-[11px] text-[#0EA5E9]">Transfer masuk/keluar terverifikasi</div>
                    </div>

                    <div className="clay rounded-[18px] p-5 space-y-1 border border-[var(--border)]">
                      <div className="text-[12px] text-[var(--text-muted)]">Total Likuiditas Kas</div>
                      <div className="text-[22px] font-extrabold text-[var(--text)]">
                        {formatRupiah(
                          cashEntriesList.reduce((acc, c) => acc + (c.direction === 'IN' ? parseDecimal(c.amount) : -parseDecimal(c.amount)), 53500000)
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">Gabungan Kas + Bank</div>
                    </div>
                  </div>

                  {/* Cash Transactions Table */}
                  <div className="clay rounded-[20px] p-5 space-y-4 border border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[16px] text-[var(--text)]">Jurnal Mutasi Kas & Bank</h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">Tanggal</th>
                            <th className="pb-3 font-semibold">Akun</th>
                            <th className="pb-3 font-semibold">Kategori Mutasi</th>
                            <th className="pb-3 font-semibold">Keterangan</th>
                            <th className="pb-3 font-semibold">Arus</th>
                            <th className="pb-3 font-semibold text-right">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {cashEntriesList.map((entry) => (
                            <tr key={entry.id} className="hover:bg-[var(--bg)]">
                              <td className="py-3 text-[var(--text-muted)]">{entry.date}</td>
                              <td className="py-3 font-bold text-[12px]">
                                <span className={`px-2 py-0.5 rounded-full ${entry.account === 'CASH' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#0EA5E9]/10 text-[#0EA5E9]'}`}>
                                  {entry.account === 'CASH' ? 'KAS TUNAI' : 'BANK'}
                                </span>
                              </td>
                              <td className="py-3 font-semibold">{entry.category}</td>
                              <td className="py-3 text-[var(--text-muted)]">{entry.description}</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${entry.direction === 'IN' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-red-500/10 text-red-500'}`}>
                                  {entry.direction === 'IN' ? 'MASUK (+)' : 'KELUAR (-)'}
                                </span>
                              </td>
                              <td className={`py-3 font-bold text-right ${entry.direction === 'IN' ? 'text-[#22C55E]' : 'text-red-500'}`}>
                                {entry.direction === 'IN' ? '+' : '-'}{formatRupiah(entry.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE: STOK BENIH PER UKURAN */}
              {(workspaceModuleTab === 'inventory' || workspaceModuleTab === 'stok') && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-bold text-[var(--text)]">Stok Benih Per Ukuran (CM / Ekor)</h2>
                      <p className="text-[13px] text-[var(--text-muted)]">Monitoring persediaan benih & adjustment benih mati di penampungan</p>
                    </div>
                  </div>

                  {/* Products / Sizes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {products.length > 0 ? (
                      products.map((p, idx) => (
                        <div key={idx} className="clay rounded-[20px] p-5 space-y-3 border border-[var(--border)]">
                          <div className="flex items-center justify-between">
                            <span className="px-3 py-1 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-[12px]">
                              Ukuran: {p.size}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--text-muted)]">{p.commodityCategory || 'Ikan Air Tawar'}</span>
                          </div>
                          <div>
                            <div className="text-[24px] font-extrabold text-[var(--text)]">
                              {formatNumber(p.stock)} <span className="text-[14px] font-normal text-[var(--text-muted)]">{p.unit || 'ekor'}</span>
                            </div>
                            <div className="text-[13px] font-bold text-[#22C55E] mt-0.5">
                              {formatRupiah(p.price)} / {p.unit || 'ekor'}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[var(--border)] flex justify-between text-[11px] text-[var(--text-muted)]">
                            <span>Terjual: {formatNumber(p.sold)} {p.unit}</span>
                            <span className="text-[#0EA5E9] font-semibold">Tersedia Siap Kirim</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full clay p-8 text-center rounded-[20px] text-[var(--text-muted)]">
                        Memuat data stok per ukuran benih...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MODULE: KWITANSI & PEMBAYARAN */}
              {(workspaceModuleTab === 'kwitansi' || workspaceModuleTab === 'receivable' || workspaceModuleTab === 'payable') && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-bold text-[var(--text)]">Kwitansi Pembayaran & Pelunasan</h2>
                      <p className="text-[13px] text-[var(--text-muted)]">Cetak & bagikan bukti pembayaran resmi ber-Kop Surat</p>
                    </div>
                  </div>

                  <div className="clay rounded-[20px] p-5 space-y-4 border border-[var(--border)]">
                    <h3 className="font-bold text-[16px] text-[var(--text)]">Daftar Kwitansi Terbit</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="pb-3 font-semibold">No Kwitansi</th>
                            <th className="pb-3 font-semibold">Tanggal</th>
                            <th className="pb-3 font-semibold">Pihak Pembayar / Penerima</th>
                            <th className="pb-3 font-semibold">Rincian Pembayaran</th>
                            <th className="pb-3 font-semibold">Metode</th>
                            <th className="pb-3 font-semibold">Total (Rp)</th>
                            <th className="pb-3 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {receiptsList.map((kw) => (
                            <tr key={kw.id} className="hover:bg-[var(--bg)]">
                              <td className="py-3 font-bold text-[#0EA5E9]">{kw.receiptNo}</td>
                              <td className="py-3 text-[var(--text-muted)]">{kw.date}</td>
                              <td className="py-3 font-semibold">{kw.payerName}</td>
                              <td className="py-3 text-[var(--text-muted)]">{kw.description}</td>
                              <td className="py-3 font-medium text-[11px]">{kw.paymentMethod}</td>
                              <td className="py-3 font-extrabold text-[var(--text)]">{formatRupiah(kw.amount)}</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => setSelectedReceipt(kw)}
                                  className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white text-[12px] font-bold hover:bg-[#0284C7] transition cursor-pointer"
                                >
                                  Cetak Kwitansi PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {workspaceModuleTab === 'master' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-[22px] text-[var(--text)]">Master Data Usaha</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                        Kelola data mitra petani pembudidaya, supplier pakan, dan daftar komoditas aktif.
                      </p>
                    </div>
                  </div>

                  {/* Tabs Master */}
                  <div className="flex border-b border-[var(--border)] gap-2">
                    <button
                      onClick={() => setMasterTab('petani')}
                      className={`pb-3 px-4 text-[13px] font-bold border-b-2 transition cursor-pointer ${
                        masterTab === 'petani'
                          ? 'border-[#0EA5E9] text-[#0EA5E9]'
                          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      Daftar Petani ({masterPetani.length})
                    </button>
                    <button
                      onClick={() => setMasterTab('komoditas')}
                      className={`pb-3 px-4 text-[13px] font-bold border-b-2 transition cursor-pointer ${
                        masterTab === 'komoditas'
                          ? 'border-[#0EA5E9] text-[#0EA5E9]'
                          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      Daftar Komoditas & Pakan ({masterKomoditas.length})
                    </button>
                  </div>

                  {masterTab === 'petani' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="text-[13px] font-bold text-[var(--text)]">Mitra Petani Aktif</div>
                        <button
                          onClick={() => setShowAddPetaniModal(true)}
                          className="h-10 px-4 rounded-xl bg-[#0EA5E9] text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#0284C7] transition cursor-pointer"
                        >
                          + Tambah Petani
                        </button>
                      </div>

                      {showAddPetaniModal && (
                        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] max-w-md space-y-3">
                          <h4 className="font-bold text-[13px]">Tambah Mitra Petani Baru</h4>
                          <div className="grid gap-2">
                            <input
                              type="text"
                              placeholder="Nama Petani (Contoh: Pak Slamet)"
                              value={newPetaniNama}
                              onChange={(e) => setNewPetaniNama(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                            />
                            <input
                              type="text"
                              placeholder="Lokasi / Wilayah (Contoh: Kediri)"
                              value={newPetaniLokasi}
                              onChange={(e) => setNewPetaniLokasi(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                            />
                            <input
                              type="text"
                              placeholder="Komoditas Utama (Contoh: Lele Sangkuriang)"
                              value={newPetaniKomoditas}
                              onChange={(e) => setNewPetaniKomoditas(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                if (!newPetaniNama.trim()) {
                                  showToast('Nama Petani wajib diisi');
                                  return;
                                }
                                setMasterPetani([
                                  ...masterPetani,
                                  {
                                    id: String(Date.now()),
                                    nama: newPetaniNama,
                                    lokasi: newPetaniLokasi || 'Kediri',
                                    komoditas: newPetaniKomoditas || 'Lele Sangkuriang',
                                    status: 'Aktif'
                                  }
                                ]);
                                showToast(`Petani ${newPetaniNama} berhasil ditambahkan!`);
                                setNewPetaniNama('');
                                setNewPetaniLokasi('');
                                setNewPetaniKomoditas('');
                                setShowAddPetaniModal(false);
                              }}
                              className="h-8 px-3 rounded-md bg-emerald-500 text-white text-[11px] font-bold"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setShowAddPetaniModal(false)}
                              className="h-8 px-3 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold dark:bg-slate-800 dark:text-slate-300"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {masterPetani.map((petani) => (
                          <div key={petani.id} className="clay rounded-[18px] p-4 border border-[var(--border)] space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold text-[14px]">
                                {petani.nama.charAt(0)}
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                                {petani.status}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-bold text-[14px] text-[var(--text)]">{petani.nama}</h4>
                              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                                📍 {petani.lokasi}
                              </p>
                              <div className="mt-2 text-[12px] font-semibold text-[#0EA5E9] bg-[#0EA5E9]/10 py-1 px-2.5 rounded-md inline-block">
                                🐟 {petani.komoditas}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="text-[13px] font-bold text-[var(--text)]">Daftar Komoditas & Pakan</div>
                        <button
                          onClick={() => setShowAddKomoditasModal(true)}
                          className="h-10 px-4 rounded-xl bg-[#0EA5E9] text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#0284C7] transition cursor-pointer"
                        >
                          + Tambah Komoditas
                        </button>
                      </div>

                      {showAddKomoditasModal && (
                        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] max-w-md space-y-3">
                          <h4 className="font-bold text-[13px]">Tambah Komoditas Baru</h4>
                          <div className="grid gap-2">
                            <input
                              type="text"
                              placeholder="Nama Komoditas (Contoh: Lele Sangkuriang 5-7cm)"
                              value={newKomoditasNama}
                              onChange={(e) => setNewKomoditasNama(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={newKomoditasTipe}
                                onChange={(e) => setNewKomoditasTipe(e.target.value)}
                                className="h-10 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                              >
                                <option value="Benih">Benih</option>
                                <option value="Konsumsi">Konsumsi</option>
                                <option value="Pakan">Pakan</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Satuan (ekor / sak)"
                                value={newKomoditasSatuan}
                                onChange={(e) => setNewKomoditasSatuan(e.target.value)}
                                className="h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                              />
                            </div>
                            <input
                              type="number"
                              placeholder="Harga Satuan (Rp)"
                              value={newKomoditasHarga}
                              onChange={(e) => setNewKomoditasHarga(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px]"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                if (!newKomoditasNama.trim() || !newKomoditasHarga) {
                                  showToast('Nama & Harga wajib diisi');
                                  return;
                                }
                                setMasterKomoditas([
                                  ...masterKomoditas,
                                  {
                                    id: String(Date.now()),
                                    nama: newKomoditasNama,
                                    tipe: newKomoditasTipe,
                                    harga: Number(newKomoditasHarga),
                                    satuan: newKomoditasSatuan || 'ekor'
                                  }
                                ]);
                                showToast(`Komoditas ${newKomoditasNama} berhasil ditambahkan!`);
                                setNewKomoditasNama('');
                                setNewKomoditasHarga('');
                                setShowAddKomoditasModal(false);
                              }}
                              className="h-8 px-3 rounded-md bg-emerald-500 text-white text-[11px] font-bold"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setShowAddKomoditasModal(false)}
                              className="h-8 px-3 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold dark:bg-slate-800 dark:text-slate-300"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {masterKomoditas.map((k) => (
                          <div key={k.id} className="clay rounded-[18px] p-4 border border-[var(--border)] flex justify-between items-center">
                            <div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${k.tipe === 'Pakan' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {k.tipe}
                              </span>
                              <h4 className="font-bold text-[14px] text-[var(--text)] mt-1.5">{k.nama}</h4>
                              <p className="text-[12px] text-emerald-500 font-extrabold mt-0.5">
                                {formatRupiah(k.harga)} <span className="text-[10px] text-[var(--text-muted)] font-normal">/ {k.satuan}</span>
                              </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center font-bold text-[var(--text)] text-[12px] border border-[var(--border)]">
                              📦
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {workspaceModuleTab === 'reports' && (
                <div className="space-y-6 max-w-[1200px]">
                  <div>
                    <h2 className="font-bold text-[22px] text-[var(--text)]">Laporan Usaha</h2>
                    <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                      Analisa performa penjualan, pengeluaran kulakan/pakan, dan laba bersih usaha secara real-time.
                    </p>
                  </div>

                  {salesTransactions.length === 0 && purchasesList.length === 0 ? (
                    <div className="clay rounded-[24px] p-8 text-center space-y-4">
                      <div className="text-[40px]">📊</div>
                      <h3 className="font-bold text-[16px]">Belum ada data keuangan</h3>
                      <p className="text-[13px] text-[var(--text-muted)] max-w-sm mx-auto">
                        Belum ada data transaksi untuk dianalisa. Mulai dengan menginput penjualan baru atau melakukan pembelian stok.
                      </p>
                      <button
                        onClick={() => setWorkspaceModuleTab('sales')}
                        className="h-10 px-5 rounded-full bg-[#0EA5E9] text-white text-[12px] font-bold cursor-pointer"
                      >
                        Mulai Input Transaksi
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Financial cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="clay rounded-[20px] p-5 space-y-2">
                          <div className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total Pendapatan (Penjualan)</div>
                          <div className="text-[24px] font-extrabold text-[#22C55E]">
                            {formatRupiah(salesTransactions.reduce((acc, tx) => acc + (tx.totalPrice || 0), 0))}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium">Dari {salesTransactions.length} transaksi invoice penjualan</div>
                        </div>

                        <div className="clay rounded-[20px] p-5 space-y-2">
                          <div className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total Pengeluaran (Pembelian PO)</div>
                          <div className="text-[24px] font-extrabold text-red-500">
                            {formatRupiah(purchasesList.reduce((acc, po) => acc + (po.totalPrice || 0), 0))}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] font-medium">Dari {purchasesList.length} PO pembelian mitra/supplier</div>
                        </div>

                        {(() => {
                          const revenue = salesTransactions.reduce((acc, tx) => acc + (tx.totalPrice || 0), 0);
                          const expense = purchasesList.reduce((acc, po) => acc + (po.totalPrice || 0), 0);
                          const profit = revenue - expense;
                          return (
                            <div className="clay rounded-[20px] p-5 space-y-2">
                              <div className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Laba / Defisit Bersih</div>
                              <div className={`text-[24px] font-extrabold ${profit >= 0 ? 'text-[#22C55E]' : 'text-amber-500'}`}>
                                {formatRupiah(profit)}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] font-medium">Laba operasional berjalan (Kas & Tempo)</div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Pure CSS Sleek Horizontal Trend Visualizer */}
                      <div className="clay rounded-[24px] p-6 space-y-4">
                        <div>
                          <h3 className="font-bold text-[15px] text-[var(--text)]">Grafik Tren Profitabilitas Bulanan</h3>
                          <p className="text-[11px] text-[var(--text-muted)]">Visualisasi perbandingan omset penjualan dan anggaran belanja</p>
                        </div>
                        <div className="space-y-4 pt-2">
                          {[
                            { month: 'Mei 2026', rev: 12500000, exp: 9000000 },
                            { month: 'Juni 2026', rev: 28400000, exp: 18500000 },
                            { month: 'Juli 2026', rev: 35000000, exp: 24000000 },
                            {
                              month: 'Agustus 2026 (Berjalan)',
                              rev: salesTransactions.reduce((acc, tx) => acc + (tx.totalPrice || 0), 0),
                              exp: purchasesList.reduce((acc, po) => acc + (po.totalPrice || 0), 0),
                            }
                          ].map((data, idx) => {
                            const maxVal = 50000000; // Normalizer
                            const revWidth = Math.min(100, Math.max(8, (data.rev / maxVal) * 100));
                            const expWidth = Math.min(100, Math.max(8, (data.exp / maxVal) * 100));
                            return (
                              <div key={idx} className="space-y-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                                <div className="flex justify-between items-center text-[12px] font-bold">
                                  <span className="text-[var(--text)]">{data.month}</span>
                                  <span className="text-[var(--text-muted)]">
                                    Laba: <span className="text-[#22C55E]">{formatRupiah(data.rev - data.exp)}</span>
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {/* Sales bar */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[var(--text-muted)] w-20">Penjualan:</span>
                                    <div className="flex-1 bg-[var(--bg)] h-3 rounded-full overflow-hidden">
                                      <div
                                        className="bg-[#22C55E] h-full rounded-full transition-all duration-500"
                                        style={{ width: `${revWidth}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-bold text-[#22C55E] w-24 text-right">{formatRupiah(data.rev)}</span>
                                  </div>
                                  {/* Expense bar */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[var(--text-muted)] w-20">Belanja:</span>
                                    <div className="flex-1 bg-[var(--bg)] h-3 rounded-full overflow-hidden">
                                      <div
                                        className="bg-red-500 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${expWidth}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-bold text-red-500 w-24 text-right">{formatRupiah(data.exp)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODULE: PENGATURAN IDENTITAS TAMBAK/DISTRIBUTOR & BACKUP */}
              {(workspaceModuleTab === 'backup' || workspaceModuleTab === 'settings' || workspaceModuleTab === 'identity' || workspaceModuleTab === 'pengaturan') && (
                <div className="space-y-6 max-w-[950px] mx-auto">
                  {/* Identitas Usaha & Logo Customizer */}
                  <div className="clay rounded-[24px] p-6 sm:p-8 space-y-6 border border-[var(--border)]">
                    <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
                      <div className="w-12 h-12 rounded-[16px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-[20px] font-extrabold text-[var(--text)]">Pengaturan Identitas Usaha & Logo Kop Surat</h2>
                        <p className="text-[13px] text-[var(--text-muted)]">Pengisian identitas tambak/kolam pembudidaya & upload logo untuk invoice & surat jalan resmi.</p>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setWorkspaceName(farmIdentity.name);
                        localStorage.setItem('tumbu-farm-identity', JSON.stringify(farmIdentity));
                        showToast('Identitas usaha & logo berhasil disimpan!');
                      }}
                      className="space-y-5"
                    >
                      {/* Logo Preview & File Upload */}
                      <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-4">
                        <label className="block text-[13px] font-bold text-[var(--text)]">Logo Usaha untuk Invoice & Surat Jalan</label>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-20 h-20 rounded-[16px] bg-[var(--card)] border border-[var(--border)] p-2 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                            <img src={farmIdentity.logoUrl || logoIconUrl} alt="Logo Usaha" className="w-full h-full object-contain" />
                          </div>
                          <div className="space-y-2 text-center sm:text-left flex-1">
                            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                              <label className="h-10 px-4 rounded-full bg-[#0EA5E9] text-white font-bold text-[12px] flex items-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-sm">
                                <Download className="w-3.5 h-3.5 rotate-180" /> Upload File Logo
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const result = ev.target?.result as string;
                                      if (result) {
                                        setFarmIdentity(prev => ({ ...prev, logoUrl: result }));
                                        showToast('Logo berhasil diunggah!');
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setFarmIdentity(prev => ({ ...prev, logoUrl: logoIconUrl }));
                                  showToast('Logo dikembalikan ke simbol TUMBU');
                                }}
                                className="h-10 px-4 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-muted)] font-semibold text-[12px] hover:text-[var(--text)] transition cursor-pointer"
                              >
                                Reset Logo
                              </button>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)]">Gunakan file PNG, JPG, atau WebP (rekomendasi rasio persegi / transparan).</p>
                          </div>
                        </div>
                      </div>

                      {/* Identitas Form Fields */}
                      <div className="grid sm:grid-cols-2 gap-4 text-[13px]">
                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Nama Usaha / Tambak / Hatchery</label>
                          <input
                            type="text"
                            value={farmIdentity.name}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Nama Penanggung Jawab (Owner / PJ)</label>
                          <input
                            type="text"
                            value={farmIdentity.owner}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, owner: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Nomor Kontak WhatsApp / Telepon</label>
                          <input
                            type="text"
                            value={farmIdentity.phone}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">NPWP Usaha (Opsional)</label>
                          <input
                            type="text"
                            value={farmIdentity.npwp}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, npwp: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-semibold mb-1 text-[12px]">Alamat Lengkap Operasional Kolam / Tambak</label>
                          <input
                            type="text"
                            value={farmIdentity.address}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, address: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Bank Pembayaran</label>
                          <input
                            type="text"
                            value={farmIdentity.bankName}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, bankName: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1 text-[12px]">Nomor Rekening Bank & Atas Nama</label>
                          <input
                            type="text"
                            value={`${farmIdentity.bankAccount}`}
                            onChange={(e) => setFarmIdentity(prev => ({ ...prev, bankAccount: e.target.value }))}
                            className="w-full h-10 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full h-11 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-md"
                      >
                        Simpan Identitas & Kop Surat
                      </button>
                    </form>
                  </div>

                  {/* PENGATURAN ANGGOTA WORKSPACE & UNDANG MEMBER */}
                  <div className="clay rounded-[24px] p-6 sm:p-8 space-y-6 border border-[var(--border)]">
                    <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
                      <div className="w-12 h-12 rounded-[16px] bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center font-bold">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-[20px] font-extrabold text-[var(--text)]">Manajemen Anggota Workspace</h2>
                        <p className="text-[13px] text-[var(--text-muted)]">Undang dan kelola anggota tim kasir, admin, atau peninjau yang berhak mengakses workspace ini.</p>
                      </div>
                    </div>

                    {/* Form Undang Member */}
                    <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-4">
                      <h3 className="font-bold text-[14px] text-[var(--text)]">Undang Anggota Tim Baru</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-[12px] font-bold mb-1.5 text-[var(--text-muted)]">ID Anggota / Email</label>
                          <input
                            type="text"
                            value={inviteEmailOrId}
                            onChange={(e) => setInviteEmailOrId(e.target.value)}
                            placeholder="budi@email.com atau ID123"
                            className="w-full box-border h-10 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#22C55E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-bold mb-1.5 text-[var(--text-muted)]">Hak Akses (Role)</label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#22C55E]"
                          >
                            <option value="OWNER">Owner (Akses Penuh)</option>
                            <option value="ADMIN">Admin (Kelola Data)</option>
                            <option value="STAFF">Staff / Kasir (Input Transaksi)</option>
                            <option value="VIEWER">Viewer (Peninjau Laporan)</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleInviteMember}
                          className="h-10 rounded-full bg-[#22C55E] text-white font-bold text-[12px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition cursor-pointer shadow-sm w-full"
                        >
                          <UserCheck className="w-4 h-4" /> Kirim Undangan
                        </button>
                      </div>
                    </div>

                    {/* Daftar Anggota */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-[14px] text-[var(--text)]">Anggota Workspace Terdaftar</h3>
                      {loadingMembers ? (
                        <div className="text-center py-4 text-[13px] text-[var(--text-muted)]">Memuat daftar anggota...</div>
                      ) : (
                        <div className="overflow-x-auto border border-[var(--border)] rounded-[18px]">
                          <table className="w-full text-left text-[13px]">
                            <thead>
                              <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)]">
                                <th className="p-3.5 font-semibold">Nama / ID / Email</th>
                                <th className="p-3.5 font-semibold">Role</th>
                                <th className="p-3.5 font-semibold">Status</th>
                                <th className="p-3.5 font-semibold">Tanggal Gabung</th>
                                <th className="p-3.5 font-semibold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {workspaceMembers.map((member) => (
                                <tr key={member.id} className="hover:bg-[var(--bg)] transition-colors">
                                  <td className="p-3.5 font-medium">
                                    <div className="font-bold text-[var(--text)]">{member.name || 'Anggota Tim'}</div>
                                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                      {member.email || member.memberId || '-'}
                                    </div>
                                  </td>
                                  <td className="p-3.5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                      member.role === 'OWNER' ? 'bg-amber-500/10 text-amber-500' :
                                      member.role === 'ADMIN' ? 'bg-blue-500/10 text-blue-500' :
                                      member.role === 'STAFF' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                                      'bg-slate-500/10 text-slate-500'
                                    }`}>
                                      {member.role}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                      {member.status === 'ACTIVE' ? 'Aktif' : 'Diundang'}
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-[12px] text-[var(--text-muted)]">
                                    {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString('id-ID', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : '-'}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    {member.role !== 'OWNER' ? (
                                      <button
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="px-3 py-1.5 rounded-full border border-red-500/20 hover:bg-red-500/10 text-red-500 text-[11px] font-semibold transition cursor-pointer"
                                      >
                                        Hapus Akses
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-[var(--text-muted)] italic">Pemilik Utama</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Backup & Restore Data */}
                  <div className="clay rounded-[24px] p-6 sm:p-8 space-y-4 border border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-[20px] font-extrabold text-[var(--text)]">Backup & Restore Workspace</h2>
                        <p className="text-[13px] text-[var(--text-muted)]">Amankan snapshot seluruh data transaksi harian secara lokal</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-3">
                        <h3 className="font-bold text-[15px] text-[var(--text)] flex items-center gap-2">
                          <Download className="w-4 h-4 text-[#0EA5E9]" /> Backup Data Sekarang
                        </h3>
                        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                          Unduh file JSON berisi seluruh data Master, Transaksi Penjualan, Surat Jalan, Stok, dan Mutasi Kas workspace ini.
                        </p>
                        <button
                          onClick={() => {
                            const backupData = {
                              workspaceName,
                              timestamp: new Date().toISOString(),
                              products,
                              salesTransactions,
                              expensesList,
                              cashEntriesList,
                              receiptsList,
                            };
                            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `backup-${workspaceName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            showToast('Backup data berhasil diunduh');
                          }}
                          className="w-full h-11 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-md"
                        >
                          Unduh Backup JSON
                        </button>
                      </div>

                      <div className="p-5 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-3">
                        <h3 className="font-bold text-[15px] text-[var(--text)] flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-[#22C55E]" /> Restore / Pulihkan Data
                        </h3>
                        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                          Pilih file JSON cadangan untuk memulihkan seluruh data transaksi workspace jika perangkat berganti.
                        </p>
                        <label className="w-full h-11 rounded-full bg-[#22C55E] text-white font-bold text-[13px] flex items-center justify-center hover:bg-emerald-600 transition cursor-pointer shadow-md">
                          <span>Upload File Backup</span>
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                try {
                                  const parsed = JSON.parse(event.target?.result as string);
                                  if (parsed.products) setProducts(parsed.products);
                                  if (parsed.salesTransactions) setSalesTransactions(parsed.salesTransactions);
                                  if (parsed.expensesList) setExpensesList(parsed.expensesList);
                                  if (parsed.cashEntriesList) setCashEntriesList(parsed.cashEntriesList);
                                  showToast('Restorasi data berhasil dilakukan!');
                                } catch {
                                  showToast('File backup tidak valid');
                                }
                              };
                              reader.readAsText(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* MODULE: AI TUMBU MEMBER & PLATFORM OS */}
              {(workspaceModuleTab === 'ai_tumbu' || platformTab === 'ai_tumbu' || workspaceModuleTab === 'ai_sentinel') && (
                null
              )}
                    </>)}
                    </MemberSkin>
)}
                  </div>
                  );
                })()
              )}
            </main>
          </div>
        </div>
      )}

      {/* DRAWER TAB: TAMBAH PENJUALAN BARU (RIGHT SIDE MINIMALIST DRAWER) */}
      {showAddSaleModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex justify-end">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-[480px] bg-[var(--card)] text-[var(--text)] h-full shadow-2xl border-l border-[var(--border)] p-6 sm:p-8 space-y-5 overflow-y-auto relative"
          >
            <button onClick={() => setShowAddSaleModal(false)} className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[var(--bg)] cursor-pointer animate-hover">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[18px]">Tambah Penjualan (Invoice)</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Input transaksi penjualan benih/pakan & tagihan</p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const hasEmptyItem = saleItems.some(it => !it.namaItem.trim() || !it.jumlah || !it.hargaSatuan);
                if (!saleCustomer.trim() || hasEmptyItem) {
                  showToast('Mohon lengkapi semua baris item!');
                  return;
                }
                setSavingSale(true);

                const computedSubtotal = saleItems.reduce((acc, item) => {
                  const q = Number(item.jumlah) || 0;
                  const p = Number(item.hargaSatuan) || 0;
                  return acc + (q * p);
                }, 0);
                const computedTotalBiayaLain = saleBiayaLain.reduce((acc, b) => {
                  return acc + (Number(b.jumlahRp) || 0);
                }, 0);
                const adjVal = Number(saleAdjustmentValue) || 0;
                const computedDiskon = saleAdjustmentType === 'DISCOUNT' ? (computedSubtotal * adjVal) / 100 : 0;
                const computedAdjustmentEkor = saleAdjustmentType === 'EXTRA' ? (computedSubtotal * adjVal) / 100 : 0;
                const computedGrandTotal = computedSubtotal - computedDiskon + computedAdjustmentEkor + computedTotalBiayaLain;

                try {
                  const txId = `tx-${Date.now()}`;
                  const newTx: TransactionRecord = {
                    id: txId,
                    sjNumber: `SJ-2026-00${salesTransactions.length + 82}`,
                    date: new Date().toISOString().split('T')[0],
                    customerName: saleCustomer.trim(),
                    type: 'SALE',
                    itemName: saleItems.map(it => it.namaItem.trim()).join(', '),
                    quantity: saleItems.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0),
                    unit: saleItems.some(it => it.namaItem.toLowerCase().includes('pelet')) ? 'sak' : 'ekor',
                    unitPrice: Number(saleItems[0]?.hargaSatuan) || 0,
                    totalPrice: computedGrandTotal,
                    paymentStatus: salePaymentStatus === 'DP' ? 'TEMPO' : salePaymentStatus,
                    connectedSupplyChain: true,
                    notes: `Status: ${salePaymentStatus}${salePaymentStatus === 'DP' ? ` (DP: ${formatRupiah(Number(saleDpAmount))})` : ''}. ${saleNotes.trim() || 'Penjualan via kasir TUMBU OS'}`,
                  };

                  // Save to state and localStorage IMMEDIATELY for Instant Response
                  const updatedList = [newTx, ...salesTransactions];
                  setSalesTransactions(updatedList);
                  try {
                    localStorage.setItem('tumbu-sales', JSON.stringify(updatedList));
                  } catch {}

                  showToast(`Penjualan ${formatRupiah(computedGrandTotal)} berhasil dicatat!`);

                  // Background fire-and-forget sync to API without blocking UI
                  (async () => {
                    try {
                      if (authToken) {
                        erpApi.createTransaction(authToken, {
                          type: 'SALE',
                          partnerName: saleCustomer,
                          itemName: saleItems.map(it => it.namaItem.trim()).join(', '),
                          quantity: saleItems.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0),
                          unitPrice: Number(saleItems[0]?.hargaSatuan) || 0,
                          totalPrice: computedGrandTotal,
                          paymentStatus: salePaymentStatus === 'DP' ? 'TEMPO' : salePaymentStatus,
                        }).catch(() => {});
                      }
                    } catch (e) {
                      console.warn('Background sync warning:', e);
                    }
                  })();
                } catch (err) {
                  console.error('Error saving transaction:', err);
                  showToast('Gagal menyimpan transaksi');
                } finally {
                  // Reset states
                  setSaleCustomer('');
                  setSaleItems([{ namaItem: '', jumlah: '', hargaSatuan: '' }]);
                  setSaleBiayaLain([]);
                  setSaleNotes('');
                  setSaleDpAmount('');
                  setSaleAdjustmentType('NONE');
                  setSaleAdjustmentValue('');
                  setSavingSale(false);
                  setShowAddSaleModal(false);
                }
              }}
              className="space-y-4 text-[13px] w-full max-w-full min-w-0 overflow-x-hidden"
            >
              <div>
                <label className="block text-[12px] font-semibold mb-1">Pelanggan / Pembudidaya</label>
                <input
                  type="text"
                  placeholder="Nama Pembeli / Pokdakan / Tambak"
                  value={saleCustomer}
                  onChange={(e) => setSaleCustomer(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  required
                />
              </div>

              {/* Dynamic Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[13px] text-[var(--text)]">Daftar Item</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[#0EA5E9] hover:text-[#0284C7] text-[12px] font-bold cursor-pointer"
                  >
                    + Tambah Item Lain
                  </button>
                </div>

                {saleItems.map((item, index) => (
                  <div key={index} className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        Item {index + 1}
                      </span>
                      {saleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-600 text-[12px] font-medium cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">
                        Item {index + 1}: Nama Item / Ukuran Benih
                      </label>
                      <input
                        type="text"
                        placeholder={index % 2 === 0 ? "Misal: Benih Lele 5-7cm" : "Misal: Pakan PF-1000"}
                        value={item.namaItem}
                        onChange={(e) => handleItemChange(index, 'namaItem', e.target.value)}
                        className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Jumlah (Ekor/Sak)</label>
                        <input
                          type="number"
                          placeholder="50000"
                          value={item.jumlah}
                          onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Harga Satuan (Rp)</label>
                        <input
                          type="number"
                          placeholder="280"
                          value={item.hargaSatuan}
                          onChange={(e) => handleItemChange(index, 'hargaSatuan', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Logistics & Other Fees (Optional) */}
              <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-[13px] text-[var(--text)]">Biaya Tambahan (Opsional)</h4>
                  <button
                    type="button"
                    onClick={handleAddBiayaLain}
                    className="text-[#0EA5E9] hover:text-[#0284C7] text-[12px] font-bold cursor-pointer"
                  >
                    + Tambah Biaya Lain
                  </button>
                </div>

                {saleBiayaLain.map((biaya, index) => (
                  <div key={index} className="p-3.5 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        Biaya {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBiayaLain(index)}
                        className="text-red-500 hover:text-red-600 text-[12px] font-medium cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Keterangan</label>
                        <input
                          type="text"
                          placeholder="Ongkir / Sewa Pickup / Karung"
                          value={biaya.keterangan}
                          onChange={(e) => handleBiayaLainChange(index, 'keterangan', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Jumlah (Rp)</label>
                        <input
                          type="number"
                          placeholder="150000"
                          value={biaya.jumlahRp}
                          onChange={(e) => handleBiayaLainChange(index, 'jumlahRp', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment & Adjustments */}
              <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                <div>
                  <label className="block text-[12px] font-semibold mb-1">Status Pembayaran</label>
                  <select
                    value={salePaymentStatus}
                    onChange={(e) => setSalePaymentStatus(e.target.value as any)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  >
                    <option value="LUNAS">LUNAS (Tunai / Transfer)</option>
                    <option value="DP">DP (Bayar Sebagian)</option>
                    <option value="TEMPO">TEMPO (Piutang Pelanggan)</option>
                  </select>
                </div>

                {salePaymentStatus === 'DP' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-[14px] bg-[var(--bg)] border border-[var(--border)] space-y-2"
                  >
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Nominal DP / Bayar Awal (Rp)</label>
                    <input
                      type="number"
                      placeholder="Masukkan nominal bayar..."
                      value={saleDpAmount}
                      onChange={(e) => setSaleDpAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#22C55E]"
                    />
                  </motion.div>
                )}

                <div className="p-4 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-3">
                  <label className="block text-[12px] font-bold text-[var(--text)]">Penyesuaian (Extra % / Diskon %)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={saleAdjustmentType}
                      onChange={(e) => setSaleAdjustmentType(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none"
                    >
                      <option value="NONE">Tanpa Penyesuaian</option>
                      <option value="EXTRA">Biaya Tambahan (+)</option>
                      <option value="DISCOUNT">Potongan Harga (-)</option>
                    </select>
                    {saleAdjustmentType !== 'NONE' && (
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Persentase"
                          value={saleAdjustmentValue}
                          onChange={(e) => setSaleAdjustmentValue(e.target.value)}
                          className="w-full h-10 pl-3 pr-8 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Summary Preview with Adjustment */}
              {(() => {
                const subtotalItems = saleItems.reduce((acc, item) => {
                  const q = Number(item.jumlah) || 0;
                  const p = Number(item.hargaSatuan) || 0;
                  return acc + (q * p);
                }, 0);
                const totalBiayaLain = saleBiayaLain.reduce((acc, b) => {
                  return acc + (Number(b.jumlahRp) || 0);
                }, 0);
                const val = Number(saleAdjustmentValue) || 0;
                const diskon = saleAdjustmentType === 'DISCOUNT' ? (subtotalItems * val) / 100 : 0;
                const adjustmentEkor = saleAdjustmentType === 'EXTRA' ? (subtotalItems * val) / 100 : 0;
                const grandTotal = subtotalItems - diskon + adjustmentEkor + totalBiayaLain;

                return (
                  <div className="p-4 rounded-[20px] bg-[#22C55E]/10 border border-[#22C55E]/20 space-y-2">
                    <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                      <span>Subtotal Ikan/Pakan:</span>
                      <span className="font-semibold">{formatRupiah(subtotalItems)}</span>
                    </div>
                    {(saleAdjustmentType !== 'NONE' && saleAdjustmentValue) ? (
                      <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                        <span>Diskon/Penyesuaian ({saleAdjustmentValue}%):</span>
                        <span className={saleAdjustmentType === 'EXTRA' ? 'text-amber-600' : 'text-red-500'}>
                          {saleAdjustmentType === 'EXTRA' ? '+' : '-'} {formatRupiah(saleAdjustmentType === 'EXTRA' ? adjustmentEkor : diskon)}
                        </span>
                      </div>
                    ) : null}
                    {totalBiayaLain > 0 ? (
                      <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                        <span>Biaya Lain-lain:</span>
                        <span className="text-amber-600">
                          + {formatRupiah(totalBiayaLain)}
                        </span>
                      </div>
                    ) : null}
                    <div className="pt-2 border-t border-[#22C55E]/20 flex justify-between items-center">
                      <span className="font-bold text-[var(--text)]">TOTAL AKHIR:</span>
                      <span className="font-extrabold text-[#22C55E] text-[18px]">
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>
                    {salePaymentStatus === 'DP' && saleDpAmount && (
                      <div className="flex justify-between items-center text-[11px] text-[#22C55E] font-bold">
                        <span>Dibayar Sekarang (DP):</span>
                        <span>{formatRupiah(Number(saleDpAmount))}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[12px] font-semibold mb-1">Catatan Transaksi</label>
                <input
                  type="text"
                  placeholder="Keterangan pengiriman / garansi..."
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <button
                type="submit"
                disabled={savingSale}
                className="w-full h-12 mt-2 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-lg"
              >
                {savingSale ? 'Menyimpan...' : 'Simpan & Terbitkan Invoice'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* DRAWER TAB: TAMBAH PURCHASE ORDER (PO) (RIGHT SIDE MINIMALIST DRAWER) */}
      {showAddPurchaseModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex justify-end">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-[540px] bg-[var(--card)] text-[var(--text)] h-full shadow-2xl border-l border-[var(--border)] p-6 sm:p-8 space-y-5 overflow-y-auto relative"
          >
            <button
              onClick={() => setShowAddPurchaseModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[var(--bg)] cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[18px]">Tambah Purchase Order (PO)</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Daftar Pembelian & Kulakan dari Petani/Supplier</p>
              </div>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const supplierNameFinal = purchaseSupplier.trim() || 'Supplier Umum / Petani';
                let validItems = purchaseItems.filter((it) => it.namaItem.trim() !== '');
                if (validItems.length === 0) {
                  validItems = [{ namaItem: 'Pembelian Stok / Kulakan', jumlah: '1', hargaSatuan: '0' }];
                }

                const computedSubtotal = validItems.reduce((acc, item) => {
                  const q = Number(item.jumlah) || 0;
                  const p = Number(item.hargaSatuan) || 0;
                  return acc + (q * p);
                }, 0);
                const computedTotalBiayaLain = purchaseBiayaLain.reduce((acc, b) => {
                  return acc + (Number(b.jumlahRp) || 0);
                }, 0);
                const adjVal = Number(purchaseAdjustmentValue) || 0;
                const computedDiskon = purchaseAdjustmentType === 'DISCOUNT' ? (computedSubtotal * adjVal) / 100 : 0;
                const computedAdjustmentEkor = purchaseAdjustmentType === 'EXTRA' ? (computedSubtotal * adjVal) / 100 : 0;
                const computedGrandTotal = computedSubtotal - computedDiskon + computedAdjustmentEkor + computedTotalBiayaLain;

                const newPo = {
                  id: `pur-${Date.now()}`,
                  poNumber: `PO-2026-00${purchasesList.length + 1}`,
                  date: new Date().toISOString().split('T')[0],
                  supplierName: supplierNameFinal,
                  itemName: validItems.map(it => it.namaItem.trim()).join(', '),
                  quantity: validItems.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0),
                  unit: validItems.some(it => it.namaItem.toLowerCase().includes('pakan') || it.namaItem.toLowerCase().includes('pelet')) ? 'sak' : 'ekor',
                  unitPrice: Number(validItems[0]?.hargaSatuan) || 0,
                  totalPrice: computedGrandTotal,
                  paymentStatus: purchasePaymentStatus === 'DP' ? 'TEMPO' : purchasePaymentStatus,
                  notes: `Status: ${purchasePaymentStatus}${purchasePaymentStatus === 'DP' ? ` (DP: ${formatRupiah(Number(purchaseDpAmount))})` : ''}. ${purchaseNotes.trim() || 'Pembelian terverifikasi via TUMBU OS'}`,
                };

                // 1. INSTANT LOCAL STATE & LOCALSTORAGE UPDATE (UI FEELS BLAZING FAST)
                const updatedPurchases = [newPo, ...purchasesList];
                setPurchasesList(updatedPurchases);
                try {
                  localStorage.setItem('tumbu-purchases', JSON.stringify(updatedPurchases));
                } catch {}

                // Reset Form & Close Drawer Modal
                setPurchaseSupplier('');
                setPurchaseItems([{ namaItem: 'Kulakan Benih / Pakan', jumlah: '', hargaSatuan: '' }]);
                setPurchaseBiayaLain([]);
                setPurchaseNotes('');
                setPurchaseDpAmount('');
                setPurchaseAdjustmentType('NONE');
                setPurchaseAdjustmentValue('');
                setShowAddPurchaseModal(false);
                showToast(`Pembelian ${formatRupiah(computedGrandTotal)} berhasil disimpan!`);

                // 2. BACKGROUND NON-BLOCKING API & FIRESTORE SYNC
                fetch('/api/erp/transactions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'PURCHASE',
                    partner: supplierNameFinal,
                    date: new Date().toISOString().split('T')[0],
                    status: purchasePaymentStatus === 'DP' ? 'DP' : (purchasePaymentStatus === 'LUNAS' ? 'PAID' : 'TEMPO'),
                    paidAmount: purchasePaymentStatus === 'DP' ? Number(purchaseDpAmount) || 0 : (purchasePaymentStatus === 'LUNAS' ? computedGrandTotal : 0),
                    nominalDP: purchasePaymentStatus === 'DP' ? Number(purchaseDpAmount) || 0 : undefined,
                    notes: purchaseNotes.trim(),
                    items: validItems.map((it) => ({
                      productName: it.namaItem.trim(),
                      quantity: Number(it.jumlah) || 1,
                      price: Number(it.hargaSatuan) || 0,
                    })),
                  }),
                }).catch((err) => console.warn('ERP API sync non-fatal:', err));
              }}
              className="space-y-4 text-[13px] w-full max-w-full min-w-0 overflow-x-hidden"
            >
              <div>
                <label className="block text-[12px] font-semibold mb-1">Supplier / Petani Penjual</label>
                <input
                  type="text"
                  placeholder="Nama Supplier / Petani Penjual"
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              {/* Dynamic PO Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[13px] text-[var(--text)]">Daftar Item</span>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItem}
                    className="text-[#0EA5E9] hover:text-[#0284C7] text-[12px] font-bold cursor-pointer"
                  >
                    + Tambah Item Lain
                  </button>
                </div>

                {purchaseItems.map((item, index) => (
                  <div key={index} className="p-4 rounded-[16px] bg-[var(--bg)] border border-[var(--border)] space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        Item {index + 1}
                      </span>
                      {purchaseItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePurchaseItem(index)}
                          className="text-red-500 hover:text-red-600 text-[12px] font-medium cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">
                        Nama Item / Ukuran Benih / Jenis Pakan
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: Benih Lele 5-7cm atau Pakan PF-1000"
                        value={item.namaItem}
                        onChange={(e) => handlePurchaseItemChange(index, 'namaItem', e.target.value)}
                        className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Jumlah (Ekor/Sak)</label>
                        <input
                          type="number"
                          placeholder="50000"
                          value={item.jumlah}
                          onChange={(e) => handlePurchaseItemChange(index, 'jumlah', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[var(--text-muted)]">Harga Satuan (Rp)</label>
                        <input
                          type="number"
                          placeholder="180"
                          value={item.hargaSatuan}
                          onChange={(e) => handlePurchaseItemChange(index, 'hargaSatuan', e.target.value)}
                          className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Logistics/Extra Costs section */}
              <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[13px] text-[var(--text)]">Biaya Tambahan (Opsional)</span>
                  <button
                    type="button"
                    onClick={handleAddPurchaseBiayaLain}
                    className="text-[#0EA5E9] hover:text-[#0284C7] text-[12px] font-bold cursor-pointer"
                  >
                    + Tambah Biaya Lain
                  </button>
                </div>

                {purchaseBiayaLain.map((biaya, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-[var(--bg)] p-3 rounded-[12px] border border-[var(--border)]">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Misal: Ongkir / Sewa Pickup"
                        value={biaya.keterangan}
                        onChange={(e) => handlePurchaseBiayaLainChange(idx, 'keterangan', e.target.value)}
                        className="w-full h-9 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none focus:border-[#0EA5E9]"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        placeholder="Jumlah Rp"
                        value={biaya.jumlahRp}
                        onChange={(e) => handlePurchaseBiayaLainChange(idx, 'jumlahRp', e.target.value)}
                        className="w-full h-9 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none focus:border-[#0EA5E9]"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseBiayaLain(idx)}
                        className="text-red-500 hover:text-red-600 text-[12px] font-bold cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment & Adjustments */}
              <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                <div>
                  <label className="block text-[12px] font-semibold mb-1">Status Pembayaran</label>
                  <select
                    value={purchasePaymentStatus}
                    onChange={(e) => setPurchasePaymentStatus(e.target.value as any)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  >
                    <option value="LUNAS">LUNAS (Pengeluaran Kas/Transfer)</option>
                    <option value="DP">DP (Bayar Sebagian)</option>
                    <option value="TEMPO">TEMPO (Hutang Supplier)</option>
                  </select>
                </div>

                {purchasePaymentStatus === 'DP' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-[14px] bg-[var(--bg)] border border-[var(--border)] space-y-2"
                  >
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Nominal DP / Bayar Awal (Rp)</label>
                    <input
                      type="number"
                      placeholder="Masukkan nominal bayar..."
                      value={purchaseDpAmount}
                      onChange={(e) => setPurchaseDpAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[13px] outline-none focus:border-[#F43F5E]"
                    />
                  </motion.div>
                )}

                <div className="p-4 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-3">
                  <label className="block text-[12px] font-bold text-[var(--text)]">Penyesuaian (Extra % / Diskon %)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={purchaseAdjustmentType}
                      onChange={(e) => setPurchaseAdjustmentType(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none"
                    >
                      <option value="NONE">Tanpa Penyesuaian</option>
                      <option value="EXTRA">Biaya Tambahan (+)</option>
                      <option value="DISCOUNT">Potongan Harga (-)</option>
                    </select>
                    {purchaseAdjustmentType !== 'NONE' && (
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Persentase"
                          value={purchaseAdjustmentValue}
                          onChange={(e) => setPurchaseAdjustmentValue(e.target.value)}
                          className="w-full h-10 pl-3 pr-8 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[12px] outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Summary Preview with Adjustment & Logistics */}
              {(() => {
                const subtotal = purchaseItems.reduce((acc, item) => {
                  const q = Number(item.jumlah) || 0;
                  const p = Number(item.hargaSatuan) || 0;
                  return acc + (q * p);
                }, 0);
                const totalBiayaLain = purchaseBiayaLain.reduce((acc, b) => {
                  return acc + (Number(b.jumlahRp) || 0);
                }, 0);
                const adjVal = Number(purchaseAdjustmentValue) || 0;
                const diskon = purchaseAdjustmentType === 'DISCOUNT' ? (subtotal * adjVal) / 100 : 0;
                const adjustmentEkor = purchaseAdjustmentType === 'EXTRA' ? (subtotal * adjVal) / 100 : 0;
                const grandTotal = subtotal - diskon + adjustmentEkor + totalBiayaLain;

                if (subtotal > 0) {
                  return (
                    <div className="p-4 rounded-[20px] bg-rose-500/10 border border-rose-500/20 space-y-2">
                      <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                        <span>Subtotal Items:</span>
                        <span className="font-semibold">{formatRupiah(subtotal)}</span>
                      </div>
                      {purchaseAdjustmentType !== 'NONE' && purchaseAdjustmentValue ? (
                        <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                          <span>{purchaseAdjustmentType === 'EXTRA' ? 'Biaya Tambahan' : 'Potongan'} ({purchaseAdjustmentValue}%):</span>
                          <span className={purchaseAdjustmentType === 'EXTRA' ? 'text-amber-600' : 'text-red-500'}>
                            {purchaseAdjustmentType === 'EXTRA' ? '+' : '-'} {formatRupiah(purchaseAdjustmentType === 'EXTRA' ? adjustmentEkor : diskon)}
                          </span>
                        </div>
                      ) : null}
                      {totalBiayaLain > 0 ? (
                        <div className="flex justify-between items-center text-[12px] text-[var(--text-muted)]">
                          <span>Biaya Lain-lain (Logistik):</span>
                          <span className="text-amber-600">
                            + {formatRupiah(totalBiayaLain)}
                          </span>
                        </div>
                      ) : null}
                      <div className="pt-2 border-t border-rose-500/20 flex justify-between items-center">
                        <span className="font-bold text-[var(--text)]">Total Akhir:</span>
                        <span className="font-extrabold text-rose-600 dark:text-rose-400 text-[18px]">
                          {formatRupiah(grandTotal)}
                        </span>
                      </div>
                      {purchasePaymentStatus === 'DP' && purchaseDpAmount && (
                        <div className="flex justify-between items-center text-[11px] text-rose-600 font-bold">
                          <span>Dibayar Sekarang (DP):</span>
                          <span>{formatRupiah(Number(purchaseDpAmount))}</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-[12px] font-semibold mb-1">Catatan / Ref Berita Acara</label>
                <input
                  type="text"
                  placeholder="Ref BA-2026-08/001, Garansi SR 95%..."
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 mt-2 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-lg"
              >
                Simpan Pembelian
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: DETAIL INVOICE & SURAT JALAN */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[520px] bg-white text-[#0F172A] rounded-[24px] p-6 shadow-2xl space-y-5 relative"
          >
            <button onClick={() => setSelectedInvoice(null)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>

            {/* Official Surat Jalan Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-200">
              <div className="flex items-center gap-2.5">
                <img src={logoIconUrl} alt="TUMBU" className="w-8 h-8 object-contain" />
                <div>
                  <div className="font-extrabold text-[16px]">TUMBU OS</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Surat Jalan & Invoice Digital</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-[15px] text-[#0EA5E9]">{selectedInvoice.sjNumber}</div>
                <div className="text-[11px] text-slate-500">{selectedInvoice.date}</div>
              </div>
            </div>

            {/* Parties Info */}
            <div className="grid grid-cols-2 gap-4 text-[12px] bg-slate-50 p-3.5 rounded-[16px] border border-slate-200">
              <div>
                <div className="text-slate-400 font-bold uppercase text-[10px]">Pengirim / Distributor</div>
                <div className="font-bold text-[13px] text-slate-900 mt-0.5">TUMBU Distributor Central</div>
                <div className="text-slate-500 text-[11px]">Hatchery & Agen Benih</div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase text-[10px]">Penerima / Pembudidaya</div>
                <div className="font-bold text-[13px] text-slate-900 mt-0.5">{selectedInvoice.customerName}</div>
                <div className="text-slate-500 text-[11px]">{selectedInvoice.notes}</div>
              </div>
            </div>

            {/* Item Details */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rincian Barang</div>
              <div className="border border-slate-200 rounded-[14px] overflow-hidden text-[13px]">
                <div className="bg-slate-100 px-3.5 py-2 font-bold flex justify-between text-slate-700">
                  <span>Item / Size</span>
                  <span>Total</span>
                </div>
                <div className="p-3.5 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span>{selectedInvoice.itemName}</span>
                    <span>{formatRupiah(selectedInvoice.totalPrice)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>{formatNumber(selectedInvoice.quantity)} {selectedInvoice.unit} × {formatRupiah(selectedInvoice.unitPrice)}</span>
                    <span className={`font-bold ${selectedInvoice.paymentStatus === 'LUNAS' ? 'text-[#22C55E]' : 'text-amber-500'}`}>
                      Status: {selectedInvoice.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Badge */}
            <div className="flex items-center justify-between p-3 rounded-[14px] bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-[12px] font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Terverifikasi Offline-First Sync</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">QR: TMB-{selectedInvoice.id.slice(-6)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                onClick={() => {
                  printSuratJalanPdf({
                    sjNumber: selectedInvoice.sjNumber,
                    date: selectedInvoice.date,
                    workspaceName: workspaceName || 'TUMBU OS DISTRIBUTION',
                    customerName: selectedInvoice.customerName,
                    items: [{
                      itemName: selectedInvoice.itemName,
                      quantity: selectedInvoice.quantity,
                      unit: selectedInvoice.unit,
                    }],
                    notes: selectedInvoice.notes
                  });
                }}
                className="w-full sm:flex-1 h-11 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" /> Cetak PDF Surat Jalan
              </button>
              <button
                onClick={() => {
                  const text = `Surat Jalan ${selectedInvoice.sjNumber}\nPelanggan: ${selectedInvoice.customerName}\nItem: ${selectedInvoice.itemName} (${selectedInvoice.quantity} ${selectedInvoice.unit})\nTotal: ${formatRupiah(selectedInvoice.totalPrice)}\nStatus: ${selectedInvoice.paymentStatus}\nDikirim via TUMBU OS`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="w-full sm:w-auto h-11 px-4 rounded-full bg-[#22C55E] text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition cursor-pointer"
              >
                Kirim WA
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-full sm:w-auto h-11 px-5 rounded-full border border-slate-300 hover:bg-slate-100 font-bold text-[13px] text-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: REVIEW TRANSAKSI HULU-HILIR OVERLAY */}
      {showHuluHilirModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[800px] bg-[var(--card)] text-[var(--text)] rounded-[24px] p-6 sm:p-8 shadow-2xl border border-[var(--border)] space-y-5 relative max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => setShowHuluHilirModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--bg)] cursor-pointer">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[20px]">Review Transaksi Hulu-Hilir (Rantai Pasok)</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Integrasi Nota Distributor dengan Modal Kolam Pembudidaya</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="clay p-4 rounded-[16px] text-[13px] space-y-1.5 border border-[#0EA5E9]/30">
                <div className="font-bold text-[#0EA5E9] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#F8BF24]" /> Keunggulan Integrasi Rantai Pasok TUMBU OS:
                </div>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Setiap pembelian benih atau pelet dari distributor otomatis tercatat di catatan modal awal pembudidaya. Hal ini mempermudah perhitungan Laba-Rugi Panen dan meniadakan selisih nota secara otomatis.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                      <th className="pb-2.5 font-semibold">Surat Jalan</th>
                      <th className="pb-2.5 font-semibold">Mitra Pembudidaya</th>
                      <th className="pb-2.5 font-semibold">Komoditas & Ukuran</th>
                      <th className="pb-2.5 font-semibold">Total Nilai</th>
                      <th className="pb-2.5 font-semibold">Status Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[var(--bg)]">
                        <td className="py-3 font-bold text-[#0EA5E9]">{tx.sjNumber}</td>
                        <td className="py-3 font-semibold">{tx.customerName}</td>
                        <td className="py-3 text-[var(--text-muted)]">{tx.itemName} ({formatNumber(tx.quantity)} {tx.unit})</td>
                        <td className="py-3 font-bold">{formatRupiah(tx.totalPrice)}</td>
                        <td className="py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tx.paymentStatus === 'LUNAS' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-amber-500/10 text-amber-500'}`}>
                            {tx.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowHuluHilirModal(false)}
                  className="h-10 px-6 rounded-full bg-[#0F172A] text-white font-bold text-[13px] hover:bg-slate-800 transition cursor-pointer"
                >
                  Tutup Review
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CETAK KWITANSI PDF / SHARE */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[550px] bg-white text-[#0F172A] rounded-[24px] p-6 shadow-2xl space-y-5 relative"
          >
            <button onClick={() => setSelectedReceipt(null)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>

            {/* Official Letterhead Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <img src={logoIconUrl} alt="TUMBU" className="w-10 h-10 object-contain" />
                <div>
                  <div className="font-extrabold text-[18px] text-slate-900">{workspaceName || 'TUMBU DISTRIBUTOR'}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">DISTRIBUTOR BENIH & OPERASIONAL PERIKANAN</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-[16px] text-[#0EA5E9]">{selectedReceipt.receiptNo}</div>
                <div className="text-[11px] text-slate-500">{selectedReceipt.date}</div>
              </div>
            </div>

            <div className="text-center py-1">
              <h3 className="font-extrabold text-[20px] uppercase tracking-wider text-slate-900">KWITANSI PEMBAYARAN</h3>
            </div>

            {/* Receipt Content Table */}
            <div className="space-y-3 text-[13px] bg-slate-50 p-4 rounded-[16px] border border-slate-200">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-semibold">Telah Diterima Dari</span>
                <span className="col-span-2 font-bold text-slate-900">{selectedReceipt.payerName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-semibold">Jumlah Uang</span>
                <span className="col-span-2 font-extrabold text-[#22C55E] text-[16px]">
                  {formatRupiah(selectedReceipt.amount)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-semibold">Untuk Pembayaran</span>
                <span className="col-span-2 font-medium text-slate-800">{selectedReceipt.description}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-semibold">Metode Pembayaran</span>
                <span className="col-span-2 font-bold text-[#0EA5E9]">{selectedReceipt.paymentMethod}</span>
              </div>
            </div>

            {/* Footer Sign & Verification */}
            <div className="flex items-end justify-between pt-2">
              <div className="text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1 font-bold text-[#22C55E]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Stamp Verifikasi Sah
                </div>
                <div>TUMBU OS Digital Signature Verified</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] text-slate-500 mb-8">Penerima Kasir / Admin</div>
                <div className="font-bold text-[13px] text-slate-900 underline">( {currentUser?.name || 'Admin Workspace'} )</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  printKwitansiPdf({
                    receiptNo: selectedReceipt.receiptNo,
                    date: selectedReceipt.date,
                    workspaceName: workspaceName || 'TUMBU OS',
                    payerName: selectedReceipt.payerName,
                    amount: selectedReceipt.amount,
                    description: selectedReceipt.description,
                    paymentMethod: selectedReceipt.paymentMethod,
                    cashierName: currentUser?.name || 'Kasir Workspace'
                  });
                }}
                className="w-full sm:flex-1 h-11 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#0284C7] transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" /> Cetak Kwitansi PDF
              </button>
              <button
                onClick={() => {
                  const text = `*KWITANSI PEMBAYARAN RESMI*\nNo: ${selectedReceipt.receiptNo}\nTanggal: ${selectedReceipt.date}\nDiterima dari: ${selectedReceipt.payerName}\nJumlah: ${formatRupiah(selectedReceipt.amount)}\nUntuk: ${selectedReceipt.description}\nMetode: ${selectedReceipt.paymentMethod}\n\nTerima kasih atas kepercayaan Anda.`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="w-full sm:w-auto h-11 px-4 rounded-full bg-[#22C55E] text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition cursor-pointer"
              >
                Kirim WA
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-full sm:w-auto h-11 px-5 rounded-full border border-slate-300 hover:bg-slate-100 font-bold text-[13px] text-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DOKUMEN CETAK RESMI: BERITA ACARA SERAH TERIMA IKAN (PRINTABLE PDF MODAL) */}
      {selectedBaForPrint && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-[680px] bg-white text-slate-900 shadow-2xl rounded-[24px] border border-slate-200 p-6 sm:p-8 space-y-5 relative max-h-[92vh] overflow-y-auto"
          >
            <button
              onClick={() => setSelectedBaForPrint(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 cursor-pointer text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Document Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-[13px]">
                    T
                  </div>
                  <span className="font-extrabold text-[15px] tracking-wide text-slate-900">TUMBU OS DISTRIBUTION</span>
                </div>
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">BERITA ACARA SERAH TERIMA BENIH</h2>
                <p className="text-[11px] text-slate-500 font-medium">Dokumen Pemeriksaan Fisik & Hitung Ulang Sekatan Bak</p>
              </div>
              <div className="text-right">
                <div className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold font-mono">
                  {selectedBaForPrint.number}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">Tanggal: {selectedBaForPrint.date}</div>
              </div>
            </div>

            {/* Parties Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-[14px] border border-slate-200 text-[12px]">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Pihak Pertama (Petani / Supplier)</span>
                <span className="font-bold text-slate-900 text-[13px]">{selectedBaForPrint.petani}</span>
                <span className="text-slate-600 block text-[11px] mt-0.5">Komoditas: {selectedBaForPrint.item}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Pihak Kedua (Distributor / QC)</span>
                <span className="font-bold text-slate-900 text-[13px]">{workspaceName}</span>
                <span className="text-slate-600 block text-[11px] mt-0.5">Pemeriksa: {currentUser?.name || 'Petugas Lapangan QC'}</span>
              </div>
            </div>

            {/* Detailed Table of Sekatan */}
            <div>
              <div className="text-[12px] font-bold text-slate-900 mb-2 flex items-center justify-between">
                <span>Rincian Hasil Hitung Fisik Per Sekat</span>
                <span className="text-[11px] text-slate-500 font-normal">Satuan: Ekor</span>
              </div>
              <table className="w-full text-left text-[12px] border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2 px-3 border-r border-slate-200">Nama Sekat</th>
                    <th className="py-2 px-3 text-right border-r border-slate-200">Hitungan Awal</th>
                    <th className="py-2 px-3 text-right border-r border-slate-200 text-emerald-700">Hitung Aktual</th>
                    <th className="py-2 px-3 text-right text-amber-700">Susut / Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedBaForPrint.sekatanDetails || [
                    { label: 'Sekatan Total', awalPetani: selectedBaForPrint.totalAwalPetani, ulangDistributor: selectedBaForPrint.totalUlangDistributor }
                  ]).map((sek: any, idx: number) => {
                    const diff = (Number(sek.awalPetani) || 0) - (Number(sek.ulangDistributor) || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">{sek.label}</td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 font-medium">{formatNumber(sek.awalPetani || 0)}</td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-emerald-600">{formatNumber(sek.ulangDistributor || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium text-amber-600">{diff > 0 ? `-${formatNumber(diff)}` : formatNumber(diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-300">
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-900">TOTAL HASIL SERAH TERIMA</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200">{formatNumber(selectedBaForPrint.totalAwalPetani)}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 text-emerald-700 font-black">{formatNumber(selectedBaForPrint.totalUlangDistributor)}</td>
                    <td className="py-2 px-3 text-right text-amber-700">-{formatNumber(selectedBaForPrint.susutEkor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes & Status */}
            <div className="text-[12px] bg-slate-50 p-3 rounded-[12px] border border-slate-200 text-slate-600">
              <span className="font-bold text-slate-800">Catatan Kondisi Fisik: </span>
              {selectedBaForPrint.notes || 'Benih sehat aktif, keseragaman grade A, air aerasi stabil selama perjalanan.'}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed italic border-t border-slate-200 pt-2">
              * Dokumen ini sah dan diterbitkan secara digital oleh platform TUMBU OS sebagai bukti kuantitas netto penerimaan benih ikan yang menjadi dasar penerbitan Purchase Order & Pembayaran.
            </p>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-4 pb-2 border-t border-slate-200 text-center text-[12px]">
              <div>
                <div className="text-slate-500 font-medium text-[11px] mb-12">Pihak Pertama (Petani Penjual)</div>
                <div className="font-bold text-slate-900 underline">( {selectedBaForPrint.petani} )</div>
              </div>
              <div>
                <div className="text-slate-500 font-medium text-[11px] mb-12">Pihak Kedua (Petugas QC & Distributor)</div>
                <div className="font-bold text-slate-900 underline">( {currentUser?.name || 'Pemeriksa Lapangan'} )</div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  printBeritaAcaraPdf({
                    baNumber: selectedBaForPrint.number,
                    date: selectedBaForPrint.date,
                    petaniName: selectedBaForPrint.petani,
                    workspaceName: workspaceName || 'TUMBU OS DISTRIBUTION',
                    komoditas: selectedBaForPrint.item,
                    sekatanDetails: selectedBaForPrint.sekatanDetails,
                    totalAwal: selectedBaForPrint.totalAwalPetani,
                    totalUlang: selectedBaForPrint.totalUlangDistributor,
                    susutEkor: selectedBaForPrint.susutEkor,
                    notes: selectedBaForPrint.notes,
                    pemeriksaName: currentUser?.name || 'Petugas Lapangan QC'
                  });
                }}
                className="flex-1 h-11 rounded-full bg-slate-900 text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-slate-800 transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" /> Cetak / Download PDF (BA Official)
              </button>
              <button
                onClick={() => {
                  const text = `*BERITA ACARA SERAH TERIMA BENIH IKAN*\nNo: ${selectedBaForPrint.number}\nTanggal: ${selectedBaForPrint.date}\nPetani: ${selectedBaForPrint.petani}\nKomoditas: ${selectedBaForPrint.item}\nHitungan Awal: ${formatNumber(selectedBaForPrint.totalAwalPetani)} ekor\nHitung Aktual Netto: ${formatNumber(selectedBaForPrint.totalUlangDistributor)} ekor\nSusut Fisik: -${formatNumber(selectedBaForPrint.susutEkor)} ekor\n\nDokumen diterbitkan oleh TUMBU OS.`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="h-11 px-5 rounded-full bg-emerald-600 text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-emerald-700 transition cursor-pointer"
              >
                Kirim WA
              </button>
              <button
                onClick={() => setSelectedBaForPrint(null)}
                className="h-11 px-5 rounded-full border border-slate-300 hover:bg-slate-100 font-bold text-[13px] text-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DRAWER TAB: TERBITKAN BERITA ACARA (BA) BARU (RIGHT SIDE MINIMALIST DRAWER WITH SEKATAN CALCULATION) */}
      {showAddBaModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex justify-end">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-[540px] bg-[var(--card)] text-[var(--text)] h-full shadow-2xl border-l border-[var(--border)] p-6 sm:p-8 space-y-5 overflow-y-auto relative"
          >
            <button onClick={() => setShowAddBaModal(false)} className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[var(--bg)] cursor-pointer">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[18px]">Berita Acara</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Pencatatan hitung ulang per sekatan/bak dari Petani ke Distributor</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!baPetani.trim()) {
                  showToast('Nama petani penjual wajib diisi');
                  return;
                }
                const totalAwal = baSekatanData.reduce((acc, s) => acc + (Number(s.awalPetani) || 0), 0);
                const totalUlang = baSekatanData.reduce((acc, s) => acc + (Number(s.ulangDistributor) || 0), 0);
                const susut = totalAwal - totalUlang;

                const newBaDoc = {
                  id: `ba-${Date.now()}`,
                  number: `BA-2026-08/00${beritaAcaraList.length + 1}`,
                  date: new Date().toISOString().split('T')[0],
                  type: 'SERAH_TERIMA',
                  petani: baPetani.trim(),
                  item: baKomoditas.trim() || 'Benih Ikan',
                  totalAwalPetani: totalAwal,
                  totalUlangDistributor: totalUlang,
                  susutEkor: susut,
                  statusImport: 'BELUM_IMPORT',
                  importedPoNumber: null,
                  notes: baNotes.trim() || `BA Serah Terima (${baSekatanData.length} Sekatan).`,
                  sekatanDetails: [...baSekatanData],
                };

                const updatedBaList = [newBaDoc, ...beritaAcaraList];
                setBeritaAcaraList(updatedBaList);
                try {
                  localStorage.setItem('tumbu-ba', JSON.stringify(updatedBaList));
                } catch {}

                setShowAddBaModal(false);
                setBaPetani('');
                setBaNotes('');
                setBaSekatanData([
                  { label: 'Sekat 1 (Depan)', awalPetani: 0, ulangDistributor: 0 },
                  { label: 'Sekat 2 (Tengah)', awalPetani: 0, ulangDistributor: 0 },
                  { label: 'Sekat 3 (Belakang)', awalPetani: 0, ulangDistributor: 0 }
                ]);
                showToast(`Berita Acara ${newBaDoc.number} berhasil diterbitkan! Netto: ${formatNumber(totalUlang)} ekor.`);
              }}
              className="space-y-4 text-[13px]"
            >
              <div>
                <label className="block font-semibold mb-1 text-[12px]">Petani Penjual / Supplier Asal</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Slamet (Kelompok Tani Mina Mandiri Kediri)"
                  value={baPetani}
                  onChange={(e) => setBaPetani(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[12px]">Komoditas / Ukuran Ikan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Benih Lele Sangkuriang (5-7 cm)"
                  value={baKomoditas}
                  onChange={(e) => setBaKomoditas(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              {/* Rincian Sekat Bak */}
              <div className="space-y-3 border border-[var(--border)] p-4 rounded-[16px] bg-[var(--bg)]">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-[13px] text-[var(--text)]">Rincian Sekat Bak</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Perbandingan hitungan awal petani vs hitung aktual distributor</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const len = baSekatanData.length;
                      setBaSekatanData([...baSekatanData, { label: `Sekat ${len + 1}`, awalPetani: 0, ulangDistributor: 0 }]);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] text-[11px] font-bold border-0 cursor-pointer hover:bg-[#0EA5E9]/20 transition"
                  >
                    + Tambah Sekat
                  </button>
                </div>

                <div className="space-y-2.5 pt-2">
                  {baSekatanData.map((sek, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2.5 items-end bg-[var(--card)] p-3 rounded-[12px] border border-[var(--border)] text-[12px]">
                      <div className="col-span-4 space-y-1">
                        <label className="block text-[11px] text-[var(--text-muted)] font-semibold">Nama Sekat</label>
                        <input
                          type="text"
                          value={sek.label}
                          onChange={(e) => {
                            const updated = [...baSekatanData];
                            updated[idx].label = e.target.value;
                            setBaSekatanData(updated);
                          }}
                          className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-semibold text-[12px] outline-none focus:border-[#0EA5E9]"
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="block text-[11px] text-[var(--text-muted)] font-semibold">Hitungan Awal</label>
                        <input
                          type="number"
                          min="0"
                          value={sek.awalPetani || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const updated = [...baSekatanData];
                            updated[idx].awalPetani = val;
                            setBaSekatanData(updated);
                          }}
                          className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-semibold text-[12px] outline-none focus:border-[#0EA5E9]"
                        />
                      </div>
                      <div className="col-span-4 space-y-1">
                        <label className="block text-[11px] text-[#22C55E] font-bold">Hitung Aktual</label>
                        <input
                          type="number"
                          min="0"
                          value={sek.ulangDistributor || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const updated = [...baSekatanData];
                            updated[idx].ulangDistributor = val;
                            setBaSekatanData(updated);
                          }}
                          className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg)] border border-[#22C55E]/40 font-bold text-[12px] text-[#22C55E] outline-none focus:border-[#22C55E]"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pb-0.5">
                        {baSekatanData.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBaSekatanData(baSekatanData.filter((_, i) => i !== idx));
                            }}
                            className="h-9 w-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0 flex items-center justify-center cursor-pointer transition"
                            title="Hapus sekat"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation Summary Card */}
                <div className="mt-3 p-3.5 rounded-[12px] bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Total Hitungan Awal:</span>
                    <span className="font-bold text-[var(--text)]">
                      {formatNumber(baSekatanData.reduce((acc, s) => acc + (Number(s.awalPetani) || 0), 0))} ekor
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Total Hitung Aktual (Netto Diterima):</span>
                    <span className="font-extrabold text-[#22C55E]">
                      {formatNumber(baSekatanData.reduce((acc, s) => acc + (Number(s.ulangDistributor) || 0), 0))} ekor
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-500 pt-1.5 border-t border-[#0EA5E9]/20 font-semibold">
                    <span>Susut / Selisih Fisik:</span>
                    <span>
                      -{formatNumber(
                        Math.max(0, baSekatanData.reduce((acc, s) => acc + (Number(s.awalPetani) || 0), 0) -
                        baSekatanData.reduce((acc, s) => acc + (Number(s.ulangDistributor) || 0), 0))
                      )} ekor
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[12px]">Catatan / Berita Acara</label>
                <input
                  type="text"
                  placeholder="Kondisi ikan sehat, air aerasi terjaga..."
                  value={baNotes}
                  onChange={(e) => setBaNotes(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-md mt-2"
              >
                + Simpan & Terbitkan BA Serah Terima
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* DRAWER TAB: TERBITKAN SURAT JALAN BARU (RIGHT SIDE MINIMALIST DRAWER WITHOUT PRICES) */}
      {showAddSjModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex justify-end">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-[480px] bg-[var(--card)] text-[var(--text)] h-full shadow-2xl border-l border-[var(--border)] p-6 sm:p-8 space-y-5 overflow-y-auto relative"
          >
            <button onClick={() => setShowAddSjModal(false)} className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[var(--bg)] cursor-pointer">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-[12px] bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[18px]">Terbitkan Surat Jalan Pengiriman</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Dokumen fisik logistik pengiriman (bebas harga/rupiah)</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sjRecipient.trim() || !sjItemName.trim()) {
                  showToast('Penerima dan Komoditas wajib diisi');
                  return;
                }
                const newSjDoc = {
                  id: `sj-${Date.now()}`,
                  sjNumber: `SJ-2026-08/${suratJalanList.length + 103}`,
                  date: new Date().toISOString().split('T')[0],
                  recipient: sjRecipient.trim(),
                  address: sjAddress.trim() || 'Lokasi Tambak Penerima',
                  driverName: sjDriverName.trim() || 'Driver Armada TUMBU',
                  vehiclePlate: sjVehiclePlate.trim() || 'AG 8888 TU',
                  itemName: sjItemName.trim(),
                  totalKoli: sjTotalKoli.trim() || '10 Box',
                  totalEkor: Number(sjTotalEkor) || 0,
                  status: 'DALAM_PENGIRIMAN',
                  notes: sjNotes.trim(),
                };

                setSuratJalanList([newSjDoc, ...suratJalanList]);
                setShowAddSjModal(false);
                setSjRecipient('');
                setSjAddress('');
                showToast(`Surat Jalan ${newSjDoc.sjNumber} berhasil diterbitkan!`);
              }}
              className="space-y-4 text-[13px]"
            >
              <div>
                <label className="block font-semibold mb-1 text-[12px]">Penerima / Pembudidaya</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pokdakan Sukamaju (Bapak Herman)"
                  value={sjRecipient}
                  onChange={(e) => setSjRecipient(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[12px]">Alamat Tujuan Pengiriman</label>
                <input
                  type="text"
                  placeholder="Contoh: Desa Sukamaju RT 03/02, Tulungagung"
                  value={sjAddress}
                  onChange={(e) => setSjAddress(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[12px]">Nama Driver / Sopir</label>
                  <input
                    type="text"
                    placeholder="Budi Santoso"
                    value={sjDriverName}
                    onChange={(e) => setSjDriverName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[12px]">No. Plat Kendaraan</label>
                  <input
                    type="text"
                    placeholder="AG 8192 UT"
                    value={sjVehiclePlate}
                    onChange={(e) => setSjVehiclePlate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[12px]">Item / Komoditas Ikan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Benih Lele Sangkuriang (5-7 cm)"
                  value={sjItemName}
                  onChange={(e) => setSjItemName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[12px]">Jumlah Koli / Box</label>
                  <input
                    type="text"
                    placeholder="15 Box Sterofoam"
                    value={sjTotalKoli}
                    onChange={(e) => setSjTotalKoli(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[12px]">Total Ekor</label>
                  <input
                    type="number"
                    placeholder="20000"
                    value={sjTotalEkor}
                    onChange={(e) => setSjTotalEkor(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] space-y-1">
                <span className="font-bold text-[#0EA5E9]">Info Logistik:</span> Surat Jalan ini tidak mencantumkan harga/nilai uang rupiah, khusus digunakan untuk bukti penerimaan pengiriman barang di lapangan.
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[12px]">Catatan Pengiriman</label>
                <input
                  type="text"
                  placeholder="Aerasi oksigen terjaga, garansi 98%..."
                  value={sjNotes}
                  onChange={(e) => setSjNotes(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[13px] outline-none focus:border-[#0EA5E9]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-[#0EA5E9] text-white font-bold text-[13px] hover:bg-[#0284C7] transition cursor-pointer shadow-md mt-2"
              >
                + Surat Jalan Baru
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: PREVIEW & CLOSING PERIODE (TUTUP BUKU) */}
      {showPreviewClosingModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[520px] bg-[var(--card)] text-[var(--text)] rounded-[24px] p-6 shadow-2xl border border-[var(--border)] space-y-4 relative"
          >
            <button onClick={() => setShowPreviewClosingModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--bg)] cursor-pointer">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[18px]">Preview Tutup Buku Bulan {closingPeriodYm}</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Verifikasi saldo kas & Laporan Laba-Rugi sebelum penguncian</p>
              </div>
            </div>

            <div className="p-4 rounded-[18px] bg-[var(--bg)] border border-[var(--border)] space-y-3 text-[13px]">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Periode Operasional</span>
                <span className="font-extrabold text-[var(--text)]">{closingPeriodYm}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Total Omset Penjualan (SJ)</span>
                <span className="font-bold text-[#22C55E]">{formatRupiah(salesTransactions.reduce((a, b) => a + b.totalPrice, 0))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Total Pengeluaran Operasional</span>
                <span className="font-bold text-red-500">
                  {formatRupiah(expensesList.reduce((a, b) => a + parseDecimal(b.amount), 0))}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                <span className="font-bold text-[var(--text)]">Laba Bersih Netto</span>
                <span className="font-extrabold text-purple-600 dark:text-purple-400 text-[16px]">
                  {formatRupiah(
                    salesTransactions.reduce((a, b) => a + b.totalPrice, 0) -
                    expensesList.reduce((a, b) => a + parseDecimal(b.amount), 0)
                  )}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-600 dark:text-amber-400 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Konfirmasi Penguncian Permanen:
              </div>
              <div>Setelah ditutup, seluruh transaksi periode {closingPeriodYm} akan dikunci agar laporan keuangan konsisten.</div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  const rev = salesTransactions.reduce((a, b) => a + b.totalPrice, 0);
                  const exp = expensesList.reduce((a, b) => a + parseDecimal(b.amount), 0);
                  const net = rev - exp;
                  const newClosing = {
                    periodYm: closingPeriodYm,
                    closedDate: new Date().toISOString().split('T')[0],
                    revenue: rev,
                    expense: exp,
                    netProfit: net,
                    status: 'LOCKED' as const,
                  };
                  setClosingHistory([newClosing, ...closingHistory]);
                  setShowPreviewClosingModal(false);
                  showToast(`Tutup Buku periode ${closingPeriodYm} berhasil dikunci!`);
                }}
                className="flex-1 h-11 rounded-full bg-purple-600 text-white font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-purple-700 transition cursor-pointer shadow-md"
              >
                Kunci Periode & Terbitkan Laporan
              </button>
              <button
                onClick={() => setShowPreviewClosingModal(false)}
                className="h-11 px-5 rounded-full border border-[var(--border)] hover:bg-[var(--bg)] font-bold text-[13px] text-[var(--text)] transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
