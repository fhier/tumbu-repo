import { NextRequest, NextResponse } from 'next/server';

let PARTNERS = [
  { id: 'ptr-1', name: 'Pak Sugeng (Kediri)', type: 'CUSTOMER', phone: '081234567890', address: 'Kediri, Jawa Timur' },
  { id: 'ptr-2', name: 'PT Tambak Makmur', type: 'CUSTOMER', phone: '081987654321', address: 'Sidoarjo, Jawa Timur' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const filtered = type ? PARTNERS.filter((p) => p.type === type) : PARTNERS;
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newPartner = {
      id: `ptr_${Date.now()}`,
      name: body.name || 'Mitra Baru',
      type: body.type || 'CUSTOMER',
      phone: body.phone || '',
      address: body.address || '',
    };
    PARTNERS.unshift(newPartner);
    return NextResponse.json(newPartner);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan mitra' }, { status: 400 });
  }
}
