import { ForbiddenException } from '@nestjs/common';
import { PlatformService } from './platform.service';

describe('PlatformService.blueprints', () => {
  const tenantContext = { userId: 'user-a', tryTenantId: () => 'tenant-a' };

  it('rejects an explicit workspace request when the user is not a member', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ isPlatformAdmin: false }) },
      membership: { findUnique: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn() },
    };
    const service = new PlatformService(
      prisma as never, tenantContext as never, {} as never, {} as never, {} as never, {} as never,
    );

    await expect(service.blueprints('tenant-b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
  });
});
