import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    step: 1,
    completed: false,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      data: body,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Gagal update onboarding' }, { status: 400 });
  }
}
