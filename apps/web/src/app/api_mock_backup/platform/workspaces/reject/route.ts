import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wsId = body.workspaceId || body.id || 'ws_new';

    return NextResponse.json({
      success: true,
      message: 'Pendaftaran ditolak oleh Platform Admin.',
      workspace: {
        id: wsId,
        status: 'REJECTED',
        statusLabel: 'Ditolak',
        isActive: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menolak pendaftaran' }, { status: 400 });
  }
}
