import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SIZES_MOCK = [
  { id: 'sz-1', name: '3-5 cm', category: 'BENIH', desc: 'Benih Ukuran 3-5 cm' },
  { id: 'sz-2', name: '5-7 cm', category: 'BENIH', desc: 'Benih Ukuran 5-7 cm' },
  { id: 'sz-3', name: '7-9 cm', category: 'BENIH', desc: 'Benih Ukuran 7-9 cm' },
  { id: 'sz-4', name: 'Konsumsi (4-6 ekor/kg)', category: 'PANEN', desc: 'Ikan Siap Panen Konsumsi' },
];

export async function GET() {
  return NextResponse.json(SIZES_MOCK);
}
