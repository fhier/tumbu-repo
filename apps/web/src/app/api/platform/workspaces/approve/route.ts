import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wsId = body.workspaceId || body.id || 'ws_new';

    return NextResponse.json({
      success: true,
      message: 'Persetujuan pendaftaran dan bukti pembayaran berhasil diberikan (ACC Platform). Workspace kini aktif.',
      workspace: {
        id: wsId,
        status: 'ACTIVE',
        statusLabel: 'Aktif / Disetujui',
        isActive: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyetujui pendaftaran' }, { status: 400 });
  }
}
