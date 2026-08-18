import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEMO_ADMIN = {
  id: 'usr_admin',
  email: 'admin@tumbu.local',
  name: 'Platform Admin',
  role: 'PLATFORM_ADMIN',
  isPlatformAdmin: true,
  emailVerified: true,
};

const DEMO_MEMBER_WORKSPACE = {
  id: 'ws_lele_sumber',
  code: 'lele-sumber',
  name: 'Lele Sumber',
  blueprintId: 'operational_distributor',
  blueprint: 'Distributor Benih',
  role: 'OWNER',
  isActive: true,
  status: 'ACTIVE',
  statusLabel: 'Aktif',
};

const ALL_WORKSPACES = [
  DEMO_MEMBER_WORKSPACE,
  {
    id: 'ws_mitra_jaya',
    code: 'mitra-jaya',
    name: 'TUMBU OS • Mitra Jaya',
    blueprintId: 'operational_aquaculture_freshwater',
    blueprint: 'Budidaya Air Tawar',
    role: 'OWNER',
    isActive: true,
    status: 'ACTIVE',
    statusLabel: 'Aktif',
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ message: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    // 1. Admin Platform Account -> Lands on Platform Admin Console
    if (email === DEMO_ADMIN.email || email.includes('admin') || email === 'alfirmansyah.sni@gmail.com') {
      const token = `token_admin_${Date.now()}`;
      return NextResponse.json({
        token,
        land: 'platform',
        user: {
          ...DEMO_ADMIN,
          email: email,
          name: email === 'alfirmansyah.sni@gmail.com' ? 'Alfirmansyah (Owner)' : DEMO_ADMIN.name,
        },
        workspaces: ALL_WORKSPACES,
      });
    }

    // 2. Member Account -> Lands on Member Workspace Dashboard
    const formattedName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Member Aktif';
    const token = `token_usr_${Date.now()}`;
    const defaultWs = {
      id: `ws_${Date.now()}`,
      code: email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: `Usaha ${formattedName}`,
      blueprintId: 'operational_distributor',
      blueprint: 'Distributor Benih',
      role: 'OWNER',
      isActive: true,
      status: 'ACTIVE',
      statusLabel: 'Aktif',
    };
    return NextResponse.json({
      token,
      land: 'workspace',
      user: {
        id: `usr_${Date.now()}`,
        email,
        name: formattedName,
        role: 'OWNER',
        isPlatformAdmin: false,
        emailVerified: true,
      },
      workspaces: [defaultWs],
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Login gagal' }, { status: 400 });
  }
}

