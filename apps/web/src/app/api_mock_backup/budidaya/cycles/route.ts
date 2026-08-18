import { NextRequest, NextResponse } from 'next/server';
import { getCyclesSnapshot, addBudidayaCycle, BudidayaCycleItem } from '@/lib/db';

export async function GET() {
  const snapshot = getCyclesSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newCycle: BudidayaCycleItem = {
      id: `c_${Date.now()}`,
      pondName: body.pondName || body.pond || 'Kolam Baru',
      fishType: body.fishType || 'Benih Lele',
      doc: 1,
      density: Number(body.density) || 10000,
      sr: 100,
      biomassKg: Number(body.biomassKg) || 50,
      state: 'ACTIVE',
    };

    addBudidayaCycle(newCycle);
    return NextResponse.json(newCycle);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal membuat siklus' }, { status: 400 });
  }
}
