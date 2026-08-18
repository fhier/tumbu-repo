import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name || 'Workspace Usaha Baru';
    const blueprintId = body.blueprintId || 'operational_distributor';

    return NextResponse.json({
      id: `ws_${Date.now()}`,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      blueprintId,
      blueprint: blueprintId === 'operational_aquaculture_freshwater' ? 'Budidaya Air Tawar' : 'Distributor Benih',
      role: 'OWNER',
      isActive: true,
      status: 'ACTIVE',
      statusLabel: 'Aktif',
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal membuat workspace' }, { status: 400 });
  }
}
