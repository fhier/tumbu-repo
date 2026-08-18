import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    if (process.env.AUTH_DISABLED === '1') return true;
    const req = context.switchToHttp().getRequest();
    const path = String(req.originalUrl || req.url || '');
    const method = String(req.method || 'GET').toUpperCase();
    if (
      path.includes('/health')
      || path.includes('/auth/login')
      || path.includes('/auth/register')
      || (method === 'POST' && path.includes('/auth/email/verify/confirm'))
      || (method === 'POST' && path.includes('/auth/password/reset/request'))
      || (method === 'POST' && path.includes('/auth/password/reset/confirm'))
      || (method === 'POST' && path.includes('/leads') && !path.includes('/platform'))
      || (method === 'POST' && path.includes('/payment/webhooks'))
      || path === '/api'
      || path === '/api/'
    ) return true;
    const header = req.headers?.authorization as string | undefined;
    const m = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
    if (!m) throw new UnauthorizedException('Silakan masuk terlebih dahulu.');
    const session = await this.auth.requireSession(m[1]);
    req.tumbuSession = session;
    req.tumbuToken = m[1];
    return true;
  }
}
