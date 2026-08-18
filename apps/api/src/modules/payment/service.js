const { prisma } = require('../../prisma-singleton');

async function getTransactionBalance(transactionId) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { settlements: true }
  });

  if (!transaction) throw new Error('Transaction not found');

  const totalPaid = transaction.settlements.reduce((sum, s) => sum + Number(s.amount), 0);
  const total = Number(transaction.total);
  const outstanding = Math.max(total - totalPaid, 0);
  
  let status = 'PAID';
  if (totalPaid === 0) status = 'BELUM_BAYAR';
  else if (totalPaid < total) status = 'SEBAGIAN';
  else status = 'LUNAS';

  return { total, totalPaid, outstanding, status };
}

module.exports = {
  getTransactionBalance
};
