import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  
  if (!authHeader || !authHeader.includes('token_')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
  }

  const isAdmin = authHeader.includes('admin');

  if (isAdmin) {
    return NextResponse.json({
      user: {
        id: 'usr_admin',
        email: 'admin@tumbu.local',
        name: 'Platform Admin',
        role: 'PLATFORM_ADMIN',
        isPlatformAdmin: true,
        emailVerified: true,
      },
      workspaces: ALL_WORKSPACES,
      activeWorkspace: ALL_WORKSPACES[0],
    });
  }

  return NextResponse.json({
    user: {
      id: 'usr_member',
      email: 'member@tumbu.id',
      name: 'Pengguna TUMBU',
      role: 'OWNER',
      isPlatformAdmin: false,
      emailVerified: true,
    },
    workspaces: [DEMO_MEMBER_WORKSPACE],
    activeWorkspace: DEMO_MEMBER_WORKSPACE,
  });
}

