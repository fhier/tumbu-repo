import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { TenantContext } from '../erp/tenant.context';

/**
 * Runs each HTTP handler inside AsyncLocalStorage tenant scope so concurrent
 * requests never share a mutable "active workspace" flag.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const session = req.tumbuSession as { tenantId?: string; userId?: string } | undefined;
    const tenantId = session?.tenantId || this.tenant.tryTenantId();
    const userId = session?.userId;

    return from(
      this.tenant.run(
        tenantId,
        async () => lastValueFrom(next.handle()),
        userId,
      ),
    );
  }
}
