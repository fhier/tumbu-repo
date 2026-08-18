import { NextRequest, NextResponse } from 'next/server';
import { getTransactionsSnapshot, addTransaction, TransactionItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const items = getTransactionsSnapshot();
  const filtered = type ? items.filter((t) => t.type === type) : items;
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type || 'SALE';
    const partnerName = body.partner || body.partnerName || body.customerName || (type === 'PURCHASE' ? 'Supplier Utama' : 'Pelanggan');

    const totalCalculated = Array.isArray(body.items) && body.items.length > 0
      ? body.items.reduce((acc: number, it: any) => acc + (Number(it.quantity || 0) * Number(it.price || it.unitPrice || 0)), 0)
      : Number(body.totalPrice || body.amount || (Number(body.quantity || 0) * Number(body.unitPrice || 0)));

    const newTx: any = {
      id: body.id || `tx_${Date.now()}`,
      number: body.number || (type === 'PURCHASE' ? `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}` : `JL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`),
      sjNumber: body.sjNumber || body.number || `SJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: body.date || new Date().toISOString().split('T')[0],
      partner: partnerName,
      partnerName: partnerName,
      customerName: partnerName,
      type: type,
      itemName: body.itemName || body.items?.[0]?.productName || body.items?.[0]?.sizeLabel || 'Komoditas Benih',
      quantity: Number(body.quantity || body.items?.[0]?.quantity || 0),
      unit: body.unit || body.items?.[0]?.unit || 'ekor',
      unitPrice: Number(body.unitPrice || body.items?.[0]?.price || 0),
      totalPrice: totalCalculated,
      total: totalCalculated,
      amount: totalCalculated,
      status: body.status || 'PAID',
      paymentStatus: body.paymentStatus || (body.status === 'PAID' ? 'LUNAS' : 'TEMPO'),
      paidAmount: Number(body.paidAmount || body.dp || 0),
      remaining: totalCalculated - Number(body.paidAmount || body.dp || 0),
      account: body.account || 'CASH',
      items: body.items || [{
        productId: 'p1',
        productName: body.itemName || 'Komoditas Benih',
        quantity: Number(body.quantity || 1),
        price: Number(body.unitPrice || totalCalculated),
        total: totalCalculated,
      }],
      notes: body.notes || '',
      meta: {
        partnerPhone: body.partnerPhone || '',
        partnerAddress: body.partnerAddress || '',
        plasePercent: body.plasePercent || 0,
        plaseType: body.plaseType || 'EXTRA',
        transport: body.transport || 0,
        jasaBongkar: body.jasaBongkar || 0,
        upahSopir: body.upahSopir || 0,
      }
    };

    addTransaction(newTx as TransactionItem);
    return NextResponse.json(newTx);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal menyimpan transaksi' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    return POST(req);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal memperbarui transaksi' }, { status: 400 });
  }
}
