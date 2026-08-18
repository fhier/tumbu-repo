import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * CTX-SYNC — Idempotency Interceptor
 * Memastikan request transaksi dengan Idempotency-Key yang sama tidak diproses 2 kali.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly MAX_ENTRIES = 5_000;
  private static cache = new Map<string, { status: number; body: unknown; timestamp: number }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const idempotencyKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body?.idempotencyKey ||
      req.body?.id;

    const session = req.tumbuSession as { tenantId?: string; userId?: string } | undefined;
    const tenantId = String(session?.tenantId || 'anonymous-tenant');
    const userId = String(session?.userId || 'anonymous-user');

    // Untuk method mutasi (POST, PUT, DELETE), jika key ada, cek cache
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && idempotencyKey) {
      IdempotencyInterceptor.pruneCache();
      const cacheKey = `${tenantId}:${userId}:${req.method}:${req.url}:${String(idempotencyKey)}`;
      const existing = IdempotencyInterceptor.cache.get(cacheKey);

      if (existing) {
        // Kembalikan respons ter-cache tanpa mengeksekusi controller ulang
        return of(existing.body);
      }

      return next.handle().pipe(
        tap((resBody) => {
          IdempotencyInterceptor.cache.set(cacheKey, {
            status: 200,
            body: resBody,
            timestamp: Date.now(),
          });
          if (IdempotencyInterceptor.cache.size > IdempotencyInterceptor.MAX_ENTRIES) {
            IdempotencyInterceptor.pruneCache();
            while (IdempotencyInterceptor.cache.size > IdempotencyInterceptor.MAX_ENTRIES) {
              const oldest = IdempotencyInterceptor.cache.keys().next().value;
              if (!oldest) break;
              IdempotencyInterceptor.cache.delete(oldest);
            }
          }
        }),
      );
    }

    return next.handle();
  }

  private static pruneCache() {
    const expiredBefore = Date.now() - IdempotencyInterceptor.TTL_MS;
    for (const [key, val] of IdempotencyInterceptor.cache.entries()) {
      if (val.timestamp < expiredBefore) {
        IdempotencyInterceptor.cache.delete(key);
      }
    }
  }
}
