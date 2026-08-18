import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wsId = body.id || 'ws_lele_sumber';

    return NextResponse.json({
      workspace: {
        id: wsId,
        name: wsId.includes('budidaya') || wsId.includes('mitra') ? 'TUMBU OS • Mitra Jaya' : 'Lele Sumber',
        blueprintId: wsId.includes('budidaya') || wsId.includes('mitra') ? 'operational_aquaculture_freshwater' : 'operational_distributor',
        status: 'ACTIVE',
        isActive: true,
      },
      modules: ['dashboard', 'pembelian', 'penjualan', 'stok', 'pengeluaran', 'kas_bank', 'master_data', 'pengaturan'],
      blueprint: {
        id: wsId.includes('budidaya') || wsId.includes('mitra') ? 'operational_aquaculture_freshwater' : 'operational_distributor',
        name: wsId.includes('budidaya') || wsId.includes('mitra') ? 'Budidaya Air Tawar' : 'Distributor Benih',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal aktivasi workspace' }, { status: 400 });
  }
}
