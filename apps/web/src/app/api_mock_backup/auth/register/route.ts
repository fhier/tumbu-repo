import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Nama, email, dan password wajib diisi.' }, { status: 400 });
    }

    const token = `token_reg_${Date.now()}`;
    return NextResponse.json({
      token,
      land: 'setup',
      user: {
        id: `usr_${Date.now()}`,
        email,
        name,
        role: 'OWNER',
        isPlatformAdmin: false,
        emailVerified: true,
      },
      workspaces: [],
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Registrasi gagal' }, { status: 400 });
  }
}
