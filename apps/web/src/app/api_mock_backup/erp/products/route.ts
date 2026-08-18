import { NextRequest, NextResponse } from 'next/server';
import { getStockSnapshot, writeStockSnapshot, StockItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getStockSnapshot();
  const mapped = snapshot.map((item: StockItem, idx: number) => ({
    id: item.id || `p_${idx + 1}`,
    name: item.ukuran,
    stock: item.stokAkhir || item.saldo || 0,
    price: item.price || 120,
    unit: item.unit || 'ekor',
    commodityCategory: item.ukuran.includes('Pelet') ? 'Pakan' : 'Benih',
    status: (item.stokAkhir || item.saldo || 0) > 0 ? 'Tersedia' : 'Habis',
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = getStockSnapshot();

    const newItem: StockItem = {
      id: `p_${Date.now()}`,
      ukuran: String(body.name || body.size || 'Ukuran Baru'),
      stokMasuk: Number(body.stock) || 0,
      stokKeluar: 0,
      stokAkhir: Number(body.stock) || 0,
      saldo: Number(body.stock) || 0,
      price: Number(body.price) || 0,
      unit: String(body.unit || 'ekor'),
    };

    const next = [...current, newItem];
    writeStockSnapshot(next);

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menambah stok' }, { status: 400 });
  }
}
