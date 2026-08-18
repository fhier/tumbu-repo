import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let SETTINGS_MEMORY = {
  name: 'PT TUMBU Indonesia Digital',
  brandName: 'TUMBU OS',
  phone: '0812-9900-1122',
  email: 'billing@tumbu.app',
  address: 'Jl. Raya Tambak No. 88, Kediri, Jawa Timur',
  code: 'TUMBU-001',
};

export async function GET() {
  return NextResponse.json(SETTINGS_MEMORY);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    SETTINGS_MEMORY = { ...SETTINGS_MEMORY, ...body };
    return NextResponse.json(SETTINGS_MEMORY);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan pengaturan' }, { status: 400 });
  }
}
