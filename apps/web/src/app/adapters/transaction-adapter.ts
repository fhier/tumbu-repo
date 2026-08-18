import { useState, useEffect, useCallback } from 'react';

export interface PwaTransactionViewModel {
  id: string;
  number: string;
  date: string; // Formatted date e.g. "07 Aug 2026"
  partnerName: string;
  customer?: string; // alias
  supplier?: string; // alias
  detail: string;
  total: number;
  status: string; // "TUNAI" or "PIUTANG"
  time: string; // Formatted time e.g. "10:21" or "1 jam lalu"
}

function formatDetail(items: any[]): string {
  if (!items || items.length === 0) return 'Tidak ada item';
  const first = items[0];
  const qty = Number(first.quantity || 0).toLocaleString('id-ID');
  const unit = first.unitLabel || first.unit || 'ekor';
  let name = first.species || first.productName || 'Barang';
  if (first.sizeLabel) name += ` (${first.sizeLabel})`;
  
  let detail = `${qty} ${unit} · ${name}`;
  if (items.length > 1) {
    detail += ` (+${items.length - 1} lainnya)`;
  }
  return detail;
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 24 && now.getDate() === d.getDate()) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffHours < 48) return 'Kemarin';
  return `${Math.floor(diffHours / 24)} hari lalu`;
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function useTransactionsAdapter(type: 'SALE' | 'PURCHASE', apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>) {
  const [transactions, setTransactions] = useState<PwaTransactionViewModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any[]>(`/erp/transactions?type=${type}`);
      
      const mapped: PwaTransactionViewModel[] = res.map(t => ({
        id: t.id,
        number: t.number || '-',
        date: formatDate(t.date),
        partnerName: t.partner || 'Unknown',
        customer: t.partner || 'Unknown',
        supplier: t.partner || 'Unknown',
        detail: formatDetail(t.items),
        total: t.total || 0,
        status: t.status === 'PAID' ? 'TUNAI' : 'PIUTANG',
        time: formatTime(t.date),
      }));
      
      setTransactions(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, type]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}
