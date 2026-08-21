// @ts-nocheck
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseTenantModules,
  tenantHasAnyModule,
  tenantHasModule,
} from '../platform/modules.util';
import { intersectModules, parsePlanModules } from '../platform/plans.util';
import { isDemoMode } from '../platform/onboarding.util';
import {
  matchApiWallRule,
  resolveRequiredModules,
} from './api-wall.map';
import { ReminderService } from '../reminder/reminder.service';

/**
 * Central Module Wall (+ map Role Wall) for /erp and /service.
 * Does not alter ERP/Service business handlers — access gate only.
 */
@Injectable()
export class ApiWallGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: ReminderService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.AUTH_DISABLED === '1') return true;

    const req = context.switchToHttp().getRequest();
    const rawPath = String(req.originalUrl || req.url || '');
    const { path, rule, walled } = matchApiWallRule(rawPath);

    if (!walled) return true;

    if (!rule) {
      throw new ForbiddenException(
        `API Wall: endpoint belum dipetakan (${path}). Tambahkan rule di api-wall.map.ts.`,
      );
    }

    const session = req.tumbuSession as {
      tenantId?: string;
      isPlatformAdmin?: boolean;
      membershipRole?: string;
    } | undefined;

    if (!session?.tenantId) {
      throw new ForbiddenException('Akses ditolak.');
    }

    // Role wall from map (PLATFORM_ADMIN bypasses role, not module)
    if (rule.roles?.length && !session.isPlatformAdmin) {
      const role = String(session.membershipRole || '').toUpperCase();
      const allowed = rule.roles.map((r) => r.toUpperCase());
      if (!allowed.includes(role)) {
        throw new ForbiddenException(
          `Peran ${role || 'anda'} tidak diizinkan untuk endpoint ini.`,
        );
      }
    }

    const tenant = await this.prisma.workspace.findUnique({
      where: { id: session.tenantId },
      select: {
        id: true, slug: true, name: true, businessType: true, status: true,
      },
    });
    if (!tenant) {
      throw new ForbiddenException('Workspace tidak ditemukan.');
    }

    // Control plane tenant has no business modules — deny domain APIs
    if (tenant.slug === '_tumbu_accounts') {
      throw new ForbiddenException(
        'Modul bisnis tidak tersedia di Control Plane. Aktifkan workspace terlebih dahulu.',
      );
    }

    // Approval Gate + Billing Enforcement — members cannot use ERP/service when not enterable
    if (!session.isPlatformAdmin) {
      const st = String(tenant.status || '');
      const isPending = st === 'PENDING';
      const isAllowedPendingRoute = isPending && req.method === 'GET' && (
        path === '/erp/dashboard' || 
        path === '/budidaya/dashboard' || 
        path === '/service/dashboard'
      );

      if (st !== 'ACTIVE' && st !== 'GRACE' && !isAllowedPendingRoute) {
        throw new ForbiddenException(
          st === 'SUSPENDED'
            ? 'Workspace ditangguhkan (billing/approval). Hubungi Platform Founder.'
            : `Workspace belum dapat dipakai (status: ${st || 'unknown'}).`,
        );
      }
    }

    let enabled: string[] = [];
    if (tenant.businessType === 'CULTIVATOR') {
      enabled = ['master', 'cycles', 'events', 'dashboard', 'analysis', 'settings', 'mod-feed', 'mod-water', 'mod-mortality', 'mod-harvest'];
    } else if (tenant.businessType === 'DISTRIBUTOR') {
      enabled = ['purchase', 'sales', 'inventory', 'cash', 'expense', 'finance', 'settings', 'mod-inventory', 'mod-do', 'dashboard'];
    } else if (tenant.businessType === 'HYBRID') {
      enabled = [
        'master', 'cycles', 'events', 'dashboard', 'analysis', 'settings', 'mod-feed', 'mod-water', 'mod-mortality', 'mod-harvest',
        'purchase', 'sales', 'inventory', 'cash', 'expense', 'finance', 'mod-inventory', 'mod-do'
      ];
    }

    const needed = resolveRequiredModules(rule, {
      method: String(req.method || 'GET').toUpperCase(),
      query: req.query || {},
      body: (req.body && typeof req.body === 'object') ? req.body : {},
    });

    if (needed.module && !tenantHasModule(enabled, needed.module)) {
      throw new ForbiddenException(
        `Modul "${needed.module}" nonaktif untuk workspace ini.`,
      );
    }
    if (needed.anyModules?.length && !tenantHasAnyModule(enabled, needed.anyModules)) {
      throw new ForbiddenException(
        `Modul terkait (${needed.anyModules.join(' / ')}) nonaktif untuk workspace ini.`,
      );
    }

    return true;
  }
}

