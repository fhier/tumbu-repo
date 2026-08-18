import { useState, useEffect, useCallback } from 'react';

export interface PwaPartnerViewModel {
  id: string;
  name: string;
  phone?: string;
}

export function usePartnersAdapter(apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>) {
  const [customers, setCustomers] = useState<PwaPartnerViewModel[]>([]);
  const [suppliers, setSuppliers] = useState<PwaPartnerViewModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError(null);
    try {
      const [cusRes, supRes] = await Promise.all([
        apiFetch<any[]>('/erp/partners?type=CUSTOMER'),
        apiFetch<any[]>('/erp/partners?type=SUPPLIER')
      ]);
      
      setCustomers(cusRes.map(c => ({ id: c.id, name: c.name, phone: c.phone })));
      setSuppliers(supRes.map(s => ({ id: s.id, name: s.name, phone: s.phone })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch partners');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  return { customers, suppliers, loading, error, refetch: fetchPartners };
}
