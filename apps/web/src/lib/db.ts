// apps/web/src/lib/db.ts - In-memory and persistent store adapter for Next.js API

export interface StockItem {
  id?: string;
  ukuran: string;
  stokMasuk: number;
  stokKeluar: number;
  stokAkhir: number;
  saldo: number;
  price: number;
  unit: string;
}

export interface BudidayaCycleItem {
  id: string;
  pondName: string;
  fishType: string;
  doc: number;
  density: number;
  sr: number;
  biomassKg: number;
  state: 'ACTIVE' | 'HARVESTED' | 'PREPARATION';
}

export interface TransactionItem {
  id: string;
  sjNumber?: string;
  number?: string;
  date?: string;
  customerName?: string;
  partnerName?: string;
  type?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  amount?: number;
  paymentStatus?: 'LUNAS' | 'TEMPO';
  status?: string;
  dueDate?: string;
  connectedSupplyChain?: boolean;
  pondDestination?: string;
  notes?: string;
}

export interface CashEntryItem {
  id: string;
  date: string;
  category: string;
  amount: number;
  direction: 'IN' | 'OUT';
  account: 'CASH' | 'BANK';
  description: string;
}

let STOCK_MEMORY: StockItem[] = [];
let CYCLES_MEMORY: BudidayaCycleItem[] = [];
let TRANSACTIONS_MEMORY: TransactionItem[] = [];
let CASH_MEMORY: CashEntryItem[] = [];

export function clearAllDemoData(): void {
  STOCK_MEMORY = [];
  CYCLES_MEMORY = [];
  TRANSACTIONS_MEMORY = [];
  CASH_MEMORY = [];
}

export function getStockSnapshot(): StockItem[] {
  return [...STOCK_MEMORY];
}

export function writeStockSnapshot(next: StockItem[]): void {
  STOCK_MEMORY = [...next];
}

export function getCyclesSnapshot(): BudidayaCycleItem[] {
  return [...CYCLES_MEMORY];
}

export function addBudidayaCycle(cycle: BudidayaCycleItem): BudidayaCycleItem {
  CYCLES_MEMORY.unshift(cycle);
  return cycle;
}

export function getTransactionsSnapshot(): TransactionItem[] {
  return [...TRANSACTIONS_MEMORY];
}

export function addTransaction(tx: TransactionItem): TransactionItem {
  TRANSACTIONS_MEMORY.unshift(tx);
  return tx;
}

export function getCashSnapshot(): CashEntryItem[] {
  return [...CASH_MEMORY];
}

export function addCashEntry(cash: CashEntryItem): CashEntryItem {
  CASH_MEMORY.unshift(cash);
  return cash;
}
