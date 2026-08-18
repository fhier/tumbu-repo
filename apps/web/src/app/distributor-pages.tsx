'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PenjualanPanel, PembelianPanel, PengeluaranPanel,
  SuratJalanPanel, BeritaAcaraPanel, KeuanganPanel,
  LaporanPanel, KwitansiPanel, CompanySettings, ClosingPanel
} from './distributor-panels';

export function DistributorPages({
  page,
  apiFetch,
  onNotify,
}: {
  page?: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (msg: string) => void;
}) {
  // Gunakan 'penjualan' sebagai default jika page adalah 'dashboard' atau kosong, 
  // karena DistributorPages belum memiliki komponen dashboard spesifik.
  const resolvedPage = !page || page === 'dashboard' ? 'penjualan' : page;
  const [distributorTab, setDistributorTab] = useState(resolvedPage);
  
  useEffect(() => {
    const nextTab = !page || page === 'dashboard' ? 'penjualan' : page;
    setDistributorTab(nextTab);
  }, [page]);
  
  // Data Master
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  
  // Data Transaksi
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [beritaAcara, setBeritaAcara] = useState<any[]>([]);
  const [suratJalan, setSuratJalan] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        resProducts, resCustomers, resSuppliers, resSizes,
        resSales, resPurchases, resCash, resBa, resSj
      ] = await Promise.all([
        apiFetch<any[]>('/erp/products').catch(() => []),
        apiFetch<any[]>('/erp/partners?type=CUSTOMER').catch(() => []),
        apiFetch<any[]>('/erp/partners?type=SUPPLIER').catch(() => []),
        apiFetch<any[]>('/erp/sizes').catch(() => []),
        apiFetch<any[]>('/erp/transactions?type=SALE').catch(() => []),
        apiFetch<any[]>('/erp/transactions?type=PURCHASE').catch(() => []),
        apiFetch<any[]>('/erp/cash').catch(() => []),
        apiFetch<any[]>('/erp/berita-acara').catch(() => []),
        apiFetch<any[]>('/erp/surat-jalan').catch(() => [])
      ]);

      setProducts(resProducts);
      setCustomers(resCustomers);
      setSuppliers(resSuppliers);
      setSizes(resSizes);
      setSales(resSales);
      setPurchases(resPurchases);
      setCash(resCash);
      setBeritaAcara(resBa);
      setSuratJalan(resSj);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data ERP');
      onNotify('Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNotify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div style={{ padding: 40 }}>Memuat modul Distributor...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: 'red' }}>
        <h3>Error memuat data</h3>
        <p>{error}</p>
        <button onClick={fetchData}>Coba Lagi</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Internal nav dihilangkan karena navigasi sekarang dikendalikan oleh AppSidebar */}
      <div style={{ padding: 24, overflowY: 'auto' }}>
        {distributorTab === 'penjualan' && (
          <PenjualanPanel apiFetch={apiFetch} onNotify={onNotify} products={products} customers={customers} sales={sales} onRefresh={fetchData} />
        )}
        {distributorTab === 'pembelian' && (
          <PembelianPanel apiFetch={apiFetch} onNotify={onNotify} products={products} suppliers={suppliers} purchases={purchases} beritaAcara={beritaAcara} onRefresh={fetchData} />
        )}
        {distributorTab === 'suratjalan' && (
          <SuratJalanPanel apiFetch={apiFetch} onNotify={onNotify} sales={sales} sizes={sizes} suratJalan={suratJalan} onRefresh={fetchData} />
        )}
        {distributorTab === 'beritaacara' && (
          <BeritaAcaraPanel apiFetch={apiFetch} onNotify={onNotify} suppliers={suppliers} sizes={sizes} beritaAcara={beritaAcara} onRefresh={fetchData} />
        )}
        {distributorTab === 'pengeluaran' && (
          <PengeluaranPanel apiFetch={apiFetch} onNotify={onNotify} cash={cash} onRefresh={fetchData} />
        )}
        {distributorTab === 'keuangan' && (
          <KeuanganPanel apiFetch={apiFetch} onNotify={onNotify} />
        )}
        {distributorTab === 'laporan' && (
          <LaporanPanel apiFetch={apiFetch} onNotify={onNotify} />
        )}
        {distributorTab === 'pengaturan' && (
          <CompanySettings apiFetch={apiFetch} onNotify={onNotify} onRefresh={fetchData} />
        )}
      </div>
    </div>
  );
}
