import { NextRequest, NextResponse } from 'next/server';
import { getCashSnapshot, addCashEntry, CashEntryItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getCashSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newCash: CashEntryItem = {
      id: `cash_${Date.now()}`,
      date: body.date || new Date().toISOString().split('T')[0],
      category: String(body.category || 'Mutasi Kas'),
      amount: Number(body.amount) || 0,
      direction: (body.direction as 'IN' | 'OUT') || 'IN',
      account: (body.account as 'CASH' | 'BANK') || 'CASH',
      description: String(body.description || body.notes || ''),
    };

    addCashEntry(newCash);
    return NextResponse.json(newCash);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal membuat mutasi kas' }, { status: 400 });
  }
}
