function buildDashboardSummary(context = {}) {
  const masterData = context.masterData || {};
  const stock = Array.isArray(context.stock) ? context.stock : [];
  const cashRows = Array.isArray(context.cashRows) ? context.cashRows : [];
  const transactions = Array.isArray(context.transactions) ? context.transactions : [];

  return {
    counts: {
      suppliers: (masterData.supplier || []).length,
      pelanggan: (masterData.pelanggan || []).length,
      ukuran: (masterData.ukuran || []).length,
      stockItems: stock.length,
      cashRows: cashRows.length,
      transactions: transactions.length
    },
    saldoKas: cashRows.reduce((sum, row) => sum + Number(row.saldo || 0), 0),
    stockSaldo: stock.reduce((sum, item) => sum + Number(item.saldo || 0), 0)
  };
}

function buildReportPayload(context = {}) {
  const summary = buildDashboardSummary(context);
  return {
    generatedAt: new Date().toISOString(),
    summary,
    masterData: context.masterData || {},
    stock: context.stock || [],
    cashRows: context.cashRows || [],
    transactions: context.transactions || []
  };
}

function buildPdfBuffer(report = {}) {
  const text = JSON.stringify(report, null, 2);
  const pdf = `%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length 44 >>stream\nBT /F1 18 Tf 20 100 Td (${text.replace(/\n/g, ' ').slice(0, 40)}) Tj ET\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000119 00000 n \n0000000206 00000 n \n0000000300 00000 n \ntrailer<< /Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

module.exports = {
  buildDashboardSummary,
  buildReportPayload,
  buildPdfBuffer
};
