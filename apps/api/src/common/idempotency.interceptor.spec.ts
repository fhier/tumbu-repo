import { of, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  beforeEach(() => {
    (IdempotencyInterceptor as any).cache.clear();
  });

  function run(tenantId: string, userId: string, nextBody: unknown, handle = jest.fn(() => of(nextBody))) {
    const req = {
      method: 'POST',
      url: '/api/v1/sync/push',
      headers: { 'idempotency-key': 'same-key' },
      body: {},
      tumbuSession: { tenantId, userId },
    };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    const interceptor = new IdempotencyInterceptor();
    return { result: lastValueFrom(interceptor.intercept(context, { handle } as any)), handle };
  }

  it('does not replay a tenant response to a different tenant using the same key', async () => {
    const first = run('tenant-a', 'user-a', { tenant: 'a' });
    await expect(first.result).resolves.toEqual({ tenant: 'a' });

    const second = run('tenant-b', 'user-b', { tenant: 'b' });
    await expect(second.result).resolves.toEqual({ tenant: 'b' });
    expect(second.handle).toHaveBeenCalledTimes(1);
  });

  it('replays only within the same tenant and user scope', async () => {
    await run('tenant-a', 'user-a', { attempt: 1 }).result;
    const duplicate = run('tenant-a', 'user-a', { attempt: 2 });

    await expect(duplicate.result).resolves.toEqual({ attempt: 1 });
    expect(duplicate.handle).not.toHaveBeenCalled();
  });
});
