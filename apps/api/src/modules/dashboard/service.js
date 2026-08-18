const { prisma } = require('../../prisma-singleton');

async function getDistributorDashboard(tenantId) {
  const transactions = await prisma.transaction.findMany({
    where: { tenantId },
    include: { settlements: true }
  });

  const summary = transactions.reduce((acc, tx) => {
    const total = Number(tx.total);
    const paid = tx.settlements.reduce((sum, s) => sum + Number(s.amount), 0);
    const remaining = Math.max(total - paid, 0);

    if (tx.type === 'SALE') {
      acc.sales += total;
      acc.receivable += remaining;
    } else {
      acc.purchases += total;
      acc.payable += remaining;
    }
    acc.cash += paid;
    return acc;
  }, { sales: 0, purchases: 0, cash: 0, receivable: 0, payable: 0 });

  return summary;
}

module.exports = { getDistributorDashboard };
