import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.AUTH_DISABLED === '1') return true;
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const session = req.tumbuSession as {
      isPlatformAdmin?: boolean;
      membershipRole?: string;
    } | undefined;
    if (!session) throw new ForbiddenException('Akses ditolak.');

    if (required.includes('PLATFORM_ADMIN')) {
      if (session.isPlatformAdmin) return true;
      throw new ForbiddenException('Hanya Platform Admin yang dapat mengakses fitur ini.');
    }

    if (session.isPlatformAdmin) return true;
    const role = String(session.membershipRole || '').toUpperCase();
    if (required.map((r) => r.toUpperCase()).includes(role)) return true;
    throw new ForbiddenException(`Peran ${role || 'anda'} tidak diizinkan untuk aksi ini.`);
  }
}
