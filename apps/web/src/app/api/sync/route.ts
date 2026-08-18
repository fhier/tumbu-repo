import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'ok', sync: 'ready' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, syncedAt: Date.now(), received: body });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 400 });
  }
}
