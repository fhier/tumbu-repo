import { BadRequestException } from '@nestjs/common';
import { ErpService } from './erp.service';

describe('ErpService inventory mutation', () => {
  const tenant = { tryTenantId: () => 'tenant-1' };

  it('deducts an aggregated SALE quantity with a conditional stock update', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ErpService({} as never, tenant as never);
    const tx = { product: { updateMany, update: jest.fn(), findFirst: jest.fn() } };

    await (service as any).applyTransactionStock(tx, 'SALE', [
      { productId: 'product-1', stockQty: 2 },
      { productId: 'product-1', stockQty: 3 },
    ], 'APPLY');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'product-1', tenantId: 'tenant-1', stock: { gte: 5 } },
      data: { stock: { decrement: 5 } },
    });
  });

  it('rejects a SALE when the conditional stock deduction cannot be applied', async () => {
    const service = new ErpService({} as never, tenant as never);
    const tx = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ name: 'Benih 10' }),
      },
    };

    await expect((service as any).applyTransactionStock(
      tx,
      'SALE',
      [{ productId: 'product-1', stockQty: 2 }],
      'APPLY',
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
