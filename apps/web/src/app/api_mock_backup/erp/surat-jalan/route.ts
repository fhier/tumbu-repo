import { NextRequest, NextResponse } from 'next/server';

let SURAT_JALAN = [
  { id: 'sj-1', number: 'SJ-2026-081', date: '2026-08-12', customerName: 'Pak Sugeng (Kediri)', driverName: 'Budi', vehicleNumber: 'N 8920 AB', status: 'DELIVERED' },
];

export async function GET() {
  return NextResponse.json(SURAT_JALAN);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newSj = {
      id: `sj_${Date.now()}`,
      number: body.number || `SJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: body.date || new Date().toISOString().split('T')[0],
      customerName: body.customerName || 'Pelanggan',
      driverName: body.driverName || 'Armada',
      vehicleNumber: body.vehicleNumber || '',
      status: body.status || 'DRAFT',
    };
    SURAT_JALAN.unshift(newSj);
    return NextResponse.json(newSj);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan Surat Jalan' }, { status: 400 });
  }
}
