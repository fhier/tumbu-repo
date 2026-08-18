import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'operational_distributor',
      name: 'Distributor Benih & Ikan',
      description: 'Pemasaran, inventori stok per ukuran cm, transaksi pembelian & penjualan benih.',
    },
    {
      id: 'operational_aquaculture_freshwater',
      name: 'Budidaya Air Tawar',
      description: 'Manajemen siklus kolam, tebar benih, FCR, pakan harian, dan pencatatan panen.',
    },
  ]);
}
