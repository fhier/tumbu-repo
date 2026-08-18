const { prisma } = require('../../prisma-singleton');

async function getSalesReport(tenantId, startDate, endDate) {
  return await prisma.transaction.findMany({
    where: { 
      tenantId, 
      type: 'SALE',
      date: { gte: startDate, lte: endDate }
    }
  });
}

async function getPayableReport(tenantId) {
  return await prisma.transaction.findMany({
    where: { tenantId, type: 'PURCHASE' },
    include: { settlements: true }
  });
}

module.exports = { getSalesReport, getPayableReport };
