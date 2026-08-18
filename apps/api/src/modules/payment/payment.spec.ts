const { createPurchaseTransaction } = require('../purchase/service');
const { createSaleTransaction } = require('../sale/service');
const { prisma } = require('../../prisma-singleton');

describe('Payment Settlement Batch 2', () => {
  beforeEach(async () => {
    await prisma.settlement.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.financialEvent.deleteMany({});
  });

  test('full supplier debt', async () => {
    const data = {
      tenantId: 'test',
      noTransaksi: 'PB-001',
      totalPembelian: 5000000,
      dibayarSekarang: 0,
      sisaHutang: 5000000,
      supplier: 'Supplier A'
    };
    const result = await createPurchaseTransaction(data);
    expect(result.sisaHutang).toBe(5000000);
  });

  test('partial supplier payment', async () => {
    const data = {
      tenantId: 'test',
      noTransaksi: 'PB-002',
      totalPembelian: 5000000,
      dibayarSekarang: 2000000,
      sisaHutang: 3000000,
      supplier: 'Supplier B'
    };
    const result = await createPurchaseTransaction(data);
    expect(result.sisaHutang).toBe(3000000);
  });
});
