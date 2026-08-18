import { openPrintDocument } from './print';
import { moneyFmt } from './tx-shell';

type ReceiptData = {
  business: { name: string; contact?: string };
  number: string;
  date: string;
  partner: string;
  items: Array<{ product: string; quantity: number; unit: string; price: number; subtotal: number; discount: number }>;
  total: number;
  paidAmount: number;
  remaining: number;
  status: string;
  notes?: string;
};

export async function renderAndPrintReceipt(data: ReceiptData) {
  const fmtRp = moneyFmt;
  
  const thermalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { width: 58mm; font-family: 'Courier New', monospace; font-size: 10px; color: #000; }
    .text-center { text-align: center; }
    .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="text-center"><b>${data.business.name}</b></div>
  <div class="divider"></div>
  <div>No: ${data.number}</div>
  <div>Tgl: ${new Date(data.date).toLocaleDateString('id-ID')}</div>
  <div>Cust: ${data.partner}</div>
  <div class="divider"></div>
  ${data.items.map(it => `
    <div>${it.product}</div>
    <div style="display:flex; justify-content:space-between">
      <span>${it.quantity} ${it.unit} x ${fmtRp(it.price)}</span>
      <b>${fmtRp(it.subtotal - it.discount)}</b>
    </div>
  `).join('')}
  <div class="divider"></div>
  <div style="display:flex; justify-content:space-between">
    <b>TOTAL</b> <b>${fmtRp(data.total)}</b>
  </div>
  <div style="display:flex; justify-content:space-between">
    <span>Dibayar</span> <span>${fmtRp(data.paidAmount)}</span>
  </div>
  <div style="display:flex; justify-content:space-between">
    <span>Sisa</span> <span>${fmtRp(data.remaining)}</span>
  </div>
</body>
</html>`;

  openPrintDocument(`Struk ${data.number}`, thermalHtml, `Struk_${data.number}.pdf`);
}
