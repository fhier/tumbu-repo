import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    workspace: {
      id: 'ws_lele_sumber',
      name: 'Lele Sumber',
      blueprintId: 'operational_distributor',
      status: 'ACTIVE',
      isActive: true,
    },
    modules: ['dashboard', 'pembelian', 'penjualan', 'stok', 'pengeluaran', 'kas_bank', 'master_data', 'pengaturan'],
    blueprint: { id: 'operational_distributor', name: 'Distributor Benih' },
  });
}
