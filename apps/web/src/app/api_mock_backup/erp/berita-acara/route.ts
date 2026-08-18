import { NextRequest, NextResponse } from 'next/server';

let BERITA_ACARA = [
  { id: 'ba-1', number: 'BA-2026-001', date: '2026-08-10', supplierName: 'Balai Benih Sukabumi', totalSeedQty: 50000, status: 'VERIFIED' },
];

export async function GET() {
  return NextResponse.json(BERITA_ACARA);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newBa = {
      id: `ba_${Date.now()}`,
      number: body.number || `BA-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: body.date || new Date().toISOString().split('T')[0],
      supplierName: body.supplierName || 'Pemasok',
      totalSeedQty: Number(body.totalSeedQty) || 0,
      status: body.status || 'DRAFT',
    };
    BERITA_ACARA.unshift(newBa);
    return NextResponse.json(newBa);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan Berita Acara' }, { status: 400 });
  }
}
