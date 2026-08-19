// @ts-nocheck
import type { PrismaService } from '../prisma/prisma.service';

/** Owner/Admin emails for a workspace (for billing notifications). */
export async function workspaceNotifyEmails(
  prisma: PrismaService,
  tenantId: string,
): Promise<Array<{ email: string; name: string }>> {
  const mems = await prisma.workspaceMember.findMany({
    where: { tenantId, role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: { select: { email: true, name: true } } },
    take: 20,
  });
  const out: Array<{ email: string; name: string }> = [];
  const seen = new Set<string>();
  for (const m of mems) {
    const email = String(m.user?.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: m.user?.name || 'Pengguna' });
  }
  return out;
}

