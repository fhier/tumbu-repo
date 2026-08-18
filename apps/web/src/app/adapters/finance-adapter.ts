import { useState, useEffect, useCallback } from 'react';

export interface PwaFinanceViewModel {
  salesToday: number;
  seedStock: number;
  cashBalance: number;
  receivables: number;
  payables: number;
  netProfit?: number;
}

export function useFinanceAdapter(apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>) {
  const [financeMetrics, setFinanceMetrics] = useState<PwaFinanceViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFinance = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError(null);
    try {
      // Menggunakan endpoint /erp/dashboard karena memuat seluruh metrik yang dibutuhkan UI
      const res = await apiFetch<any>('/erp/dashboard');
      
      let salesToday = 0;
      if (res.trend && res.trend.length >= 7) {
        // trend[6] adalah hari ini
        salesToday = res.trend[6].penjualan || 0;
      } else {
        // Fallback GAP jika array trend tidak sesuai format
        salesToday = res.metrics?.sales || 0; 
      }

      const mapped: PwaFinanceViewModel = {
        salesToday: salesToday,
        seedStock: res.totalStokBenih || 0,
        cashBalance: res.metrics?.cashBalance || 0,
        receivables: res.metrics?.receivables || 0,
        payables: res.metrics?.payables || 0,
        netProfit: res.metrics?.laba !== undefined ? res.metrics.laba : undefined,
      };
      
      setFinanceMetrics(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch finance metrics');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance]);

  return { financeMetrics, loading, error, refetch: fetchFinance };
}
