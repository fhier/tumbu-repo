import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'ws_lele_sumber',
      code: 'lele-sumber',
      name: 'Lele Sumber',
      blueprintId: 'operational_distributor',
      blueprint: 'Distributor Benih',
      role: 'OWNER',
      isActive: true,
      status: 'ACTIVE',
      statusLabel: 'Aktif',
    },
    {
      id: 'ws_mitra_jaya',
      code: 'mitra-jaya',
      name: 'TUMBU OS • Mitra Jaya',
      blueprintId: 'operational_aquaculture_freshwater',
      blueprint: 'Budidaya Air Tawar',
      role: 'OWNER',
      isActive: true,
      status: 'ACTIVE',
      statusLabel: 'Aktif',
    },
  ]);
}
