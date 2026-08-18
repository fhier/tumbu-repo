import { useState, useEffect, useCallback } from 'react';

export interface PwaProductViewModel {
  id: string;
  name: string;
  sizeLabel?: string;
  stock: number;
  unit: string;
  price: number;
  category: string;
  species?: string;
}

export function useProductsAdapter(apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>) {
  const [products, setProducts] = useState<PwaProductViewModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any[]>('/erp/products');
      
      const mapped = res.map(p => ({
        id: p.id,
        name: p.name,
        sizeLabel: p.sizeLabel || undefined,
        stock: p.stock || 0,
        unit: p.unitLabel || p.unit || '',
        price: p.price || 0,
        category: p.commodityCategory || '',
        species: p.species || undefined
      }));
      
      setProducts(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
