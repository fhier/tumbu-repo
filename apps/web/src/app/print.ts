/** Preview dokumen cetak — modal ringkas Preview / Thermal / Download / Share. */

let blobUrl: string | null = null;
let blobFile: Blob | null = null;
let fileName = 'dokumen.pdf';
let currentDocHtml = '';
let currentDocTitle = '';

function ensureModal() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('tumbu-pdf-modal');
  if (modal && modal.dataset.v === '4') return modal;
  if (modal) modal.remove();
  const oldStyle = document.getElementById('tumbu-pdf-style');
  if (oldStyle) oldStyle.remove();

  modal = document.createElement('div');
  modal.id = 'tumbu-pdf-modal';
  modal.dataset.v = '4';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="tumbu-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="tumbu-pdf-title">
      <div class="tumbu-pdf-head">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="tumbu-pdf-icon">PDF</div>
          <div>
            <b id="tumbu-pdf-title">Preview Dokumen</b>
            <div id="tumbu-pdf-nama" class="tumbu-pdf-nama">dokumen.pdf</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="tumbu-pdf-tab active" data-tab="pdf">📄 Mode Resmi / PDF</button>
          <button type="button" class="tumbu-pdf-tab" data-tab="thermal">📟 Struk Thermal (58mm)</button>
          <button type="button" class="tumbu-pdf-close" data-act="close" title="Tutup" aria-label="Tutup">&times;</button>
        </div>
      </div>

      <div class="tumbu-pdf-preview-container">
        <iframe id="tumbu-pdf-frame" title="Dokumen Preview" src="about:blank"></iframe>
      </div>

      <div class="tumbu-pdf-actions">
        <button type="button" class="tumbu-pdf-btn primary" data-act="print-direct">🖨️ Cetak / Print PDF</button>
        <button type="button" class="tumbu-pdf-btn thermal-btn" data-act="print-thermal">📟 Cetak Thermal Bluetooth</button>
        <button type="button" class="tumbu-pdf-btn" data-act="download">📥 Download File</button>
        <button type="button" class="tumbu-pdf-btn" data-act="close">✕ Tutup</button>
      </div>
    </div>
  `;
  const style = document.createElement('style');
  style.id = 'tumbu-pdf-style';
  style.textContent = `
    #tumbu-pdf-modal{position:fixed;inset:0;z-index:99999;background:rgba(10,31,61,.75);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:12px}
    #tumbu-pdf-modal.show{display:flex}
    .tumbu-pdf-dialog{width:min(860px,96vw);height:min(90vh,780px);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.35);font-family:'Plus Jakarta Sans',system-ui,sans-serif;display:flex;flex-direction:column}
    .tumbu-pdf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px;border-bottom:1px solid #E2E8F0;background:#F8FAFC;flex-shrink:0}
    .tumbu-pdf-head b{font-size:14px;color:#0A1F3D;display:block;line-height:1.2}
    .tumbu-pdf-nama{font-size:11px;color:#64748B;margin-top:2px}
    .tumbu-pdf-icon{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;background:#0284C7;width:36px;height:36px;border-radius:10px;flex-shrink:0}
    .tumbu-pdf-tab{padding:6px 12px;border-radius:8px;font-size:11.5px;font-weight:700;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer}
    .tumbu-pdf-tab.active{background:#0A1F3D;color:#fff;border-color:#0A1F3D}
    .tumbu-pdf-close{border:1px solid #CBD5E1;background:#fff;width:32px;height:32px;border-radius:8px;font-size:18px;line-height:1;cursor:pointer;color:#64748B;display:flex;align-items:center;justify-content:center}
    .tumbu-pdf-preview-container{flex:1;background:#E2E8F0;position:relative;overflow:hidden}
    #tumbu-pdf-frame{width:100%;height:100%;border:none;background:#fff}
    .tumbu-pdf-actions{display:flex;gap:8px;padding:12px 18px;border-top:1px solid #E2E8F0;background:#fff;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
    .tumbu-pdf-btn{height:40px;padding:0 16px;border-radius:10px;border:1px solid #CBD5E1;background:#fff;color:#0A1F3D;cursor:pointer;font-weight:700;font-size:12.5px}
    .tumbu-pdf-btn.primary{background:#0284C7;color:#fff;border-color:#0284C7}
    .tumbu-pdf-btn.thermal-btn{background:#00D084;color:#0A1F3D;border-color:#00D084}
    @media(max-width:640px){.tumbu-pdf-actions{display:grid;grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  modal.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === modal) closePdfModal();
    const act = t.closest('[data-act]')?.getAttribute('data-act');
    if (act === 'close') closePdfModal();
    if (act === 'print-direct') printIframeContent();
    if (act === 'print-thermal') printIframeThermal();
    if (act === 'download') downloadPdf();

    const tab = t.closest('[data-tab]')?.getAttribute('data-tab');
    if (tab === 'pdf') renderFrameHtml(currentDocHtml, 'pdf');
    if (tab === 'thermal') renderFrameHtml(generateThermalVersion(currentDocHtml, currentDocTitle), 'thermal');
  });

  document.body.appendChild(modal);
  return modal;
}

function closePdfModal() {
  const modal = document.getElementById('tumbu-pdf-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function renderFrameHtml(html: string, mode: 'pdf' | 'thermal') {
  const frame = document.getElementById('tumbu-pdf-frame') as HTMLIFrameElement | null;
  if (!frame) return;
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  const tabs = document.querySelectorAll('.tumbu-pdf-tab');
  tabs.forEach((tb) => {
    const isMode = tb.getAttribute('data-tab') === mode;
    tb.classList.toggle('active', isMode);
  });
}

function printIframeContent() {
  const frame = document.getElementById('tumbu-pdf-frame') as HTMLIFrameElement | null;
  if (frame && frame.contentWindow) {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.print();
    }
  }
}

function printIframeThermal() {
  renderFrameHtml(generateThermalVersion(currentDocHtml, currentDocTitle), 'thermal');
  setTimeout(() => {
    printIframeContent();
  }, 300);
}

function downloadPdf() {
  if (!blobUrl) return;
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sanitizeFileName(title: string, preferred?: string) {
  const raw = String(preferred || title || 'dokumen').trim();
  let base = raw.replace(/[^\w\-.\s]+/g, '').replace(/\s+/g, '_') || 'dokumen';
  if (base.toLowerCase().endsWith('.html')) base = base.slice(0, -5);
  if (!base.toLowerCase().endsWith('.pdf')) base = `${base}.pdf`;
  return base;
}

function generateThermalVersion(fullHtml: string, title: string): string {
  // Strip complex HTML and extract basic text to format as 58mm Thermal Receipt
  const parser = new DOMParser();
  const parsed = parser.parseFromString(fullHtml, 'text/html');
  const bodyText = parsed.body.innerText || '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=58mm, initial-scale=1"/>
  <title>Thermal Struk - ${title}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    body {
      width: 58mm;
      margin: 0 auto;
      padding: 8px 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10.5px;
      line-height: 1.25;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .btn-print { display: block; width: 100%; padding: 6px; background: #000; color: #fff; font-weight: bold; font-size: 11px; text-align: center; border: none; margin-bottom: 8px; cursor: pointer; }
    @media print { .btn-print { display: none; } }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ CETAK KE PRINTER THERMAL (58mm)</button>
  <div class="text-center bold" style="font-size: 13px;">TUMBU OS PRINTER</div>
  <div class="text-center bold">${title}</div>
  <div class="divider"></div>
  <pre style="white-space: pre-wrap; font-family: inherit; font-size: 10px; margin:0;">${bodyText.slice(0, 1200)}</pre>
  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; margin-top: 6px;">
    Dicetak via TUMBU OS Thermal Module<br/>
    *** BUKTI TRANSAKSI SAH ***
  </div>
</body>
</html>`;
}

/**
 * Buka hasil generate dokumen (HTML cetakable).
 * Preview otomatis di modal internal tanpa tergantung popup window.open.
 */
export function openPrintDocument(title: string, html: string, preferredFileName?: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!html || !String(html).trim()) {
    alert('Dokumen PDF/print tidak tersedia.');
    return;
  }

  currentDocHtml = html;
  currentDocTitle = title;

  const body = /<html[\s>]/i.test(html)
    ? html
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeAttr(title)}</title></head><body>${html}</body></html>`;

  if (blobUrl) {
    try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
  }
  blobFile = new Blob([body], { type: 'text/html;charset=utf-8' });
  blobUrl = URL.createObjectURL(blobFile);
  fileName = sanitizeFileName(title, preferredFileName);

  const modal = ensureModal();
  if (modal) {
    const titleEl = document.getElementById('tumbu-pdf-title');
    const namaEl = document.getElementById('tumbu-pdf-nama');
    if (titleEl) titleEl.textContent = title || fileName;
    if (namaEl) namaEl.textContent = fileName;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    renderFrameHtml(body, 'pdf');
  }
}

function escapeAttr(v: string) {
  return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Opsi 1: Cetak Thermal Bluetooth 58mm / 80mm (Struk Portable Lapangan).
 */
export function printThermalReceipt(data: {
  title: string;
  number: string;
  date: string;
  partnerName: string;
  partnerRole: string;
  items: Array<{ name: string; sizeLabel?: string; qty: number; price: number; total: number }>;
  totalAmount: number;
  notes?: string;
  driver?: string;
  vehicle?: string;
}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
  const fmtRp = (n: number) => `Rp ${fmt(n)}`;

  const thermalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=58mm, initial-scale=1"/>
  <title>Struk Thermal - ${data.number}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    body {
      width: 58mm;
      margin: 0 auto;
      padding: 6px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #FFF;
      line-height: 1.2;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .btn-print {
      display: block; width: 100%; padding: 8px; background: #000; color: #FFF;
      text-align: center; font-weight: bold; border: none; margin-bottom: 10px; cursor: pointer;
    }
    @media print { .btn-print { display: none; } }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ CETAK VIA BLUETOOTH THERMAL (58mm)</button>
  <div class="text-center bold" style="font-size: 14px;">TUMBU OS</div>
  <div class="text-center">Struk Transaksi Lapangan</div>
  <div class="divider"></div>
  <div>No   : ${data.number}</div>
  <div>Tgl  : ${data.date}</div>
  <div>${data.partnerRole}: ${data.partnerName}</div>
  ${data.driver ? `<div>Sopir: ${data.driver} (${data.vehicle || '-'})</div>` : ''}
  <div class="divider"></div>
  <div class="bold">RINCIAN ITEM:</div>
  ${data.items.map((it) => `
    <div>${it.name} ${it.sizeLabel ? `(${it.sizeLabel})` : ''}</div>
    <div class="row">
      <span>  ${fmt(it.qty)} x Rp ${fmt(it.price)}</span>
      <span class="bold">${fmtRp(it.total)}</span>
    </div>
  `).join('')}
  <div class="divider"></div>
  <div class="row bold" style="font-size: 12px;">
    <span>TOTAL:</span>
    <span>${fmtRp(data.totalAmount)}</span>
  </div>
  <div class="divider"></div>
  ${data.notes ? `<div style="font-size: 10px;">Catatan: ${data.notes}</div><div class="divider"></div>` : ''}
  <div class="text-center" style="margin-top: 10px; font-size: 10px;">
    Terima kasih atas kerjasama Anda.<br/>
    *** BUKTI CETAK THERMAL SAH ***
  </div>
</body>
</html>`;

  openPrintDocument(`${data.title} - ${data.number}`, thermalHtml, `Struk_Thermal_${data.number}.pdf`);
}

const pdfBaseStyle = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; }
  .logo-title { font-size: 20px; font-weight: 800; color: #0284C7; letter-spacing: -0.5px; }
  .logo-sub { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-info { text-align: right; }
  .doc-num { font-size: 16px; font-weight: 800; color: #0EA5E9; font-family: monospace; }
  .doc-date { font-size: 11px; color: #64748B; }
  .title-bar { text-align: center; margin: 12px 0 16px; }
  .title-bar h2 { margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F172A; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .card-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 11px; }
  .card-box strong { color: #0F172A; font-size: 12px; display: block; margin-bottom: 2px; }
  .label-sm { color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
  table.pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  table.pdf-table th { background: #F1F5F9; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #CBD5E1; }
  table.pdf-table td { padding: 8px 10px; border: 1px solid #E2E8F0; }
  table.pdf-table tfoot td { font-weight: 800; background: #F8FAFC; border-top: 2px solid #CBD5E1; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .badge-stamp { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #DCFCE7; border: 1px solid #86EFAC; color: #166534; font-size: 11px; font-weight: 700; border-radius: 20px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; text-align: center; page-break-inside: avoid; }
  .sig-line { margin-top: 50px; font-weight: 700; border-top: 1px solid #94A3B8; display: inline-block; padding-top: 4px; min-width: 140px; }
  .footer-note { font-size: 10px; color: #94A3B8; text-align: center; margin-top: 20px; border-top: 1px solid #E2E8F0; padding-top: 8px; font-style: italic; }
`;

function fmtRp(num: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
}

function fmtNum(num: number) {
  return (num || 0).toLocaleString('id-ID');
}

/** Cetak PDF Surat Jalan Pengiriman Barcode/Verification */
export function printSuratJalanPdf(data: {
  sjNumber: string;
  date: string;
  workspaceName: string;
  customerName: string;
  destination?: string;
  vehicle?: string;
  driver?: string;
  items: Array<{ itemName: string; quantity: number; unit?: string; notes?: string }>;
  notes?: string;
  signerName?: string;
}) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Surat Jalan - ${data.sjNumber}</title>
  <style>${pdfBaseStyle}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">${data.workspaceName || 'TUMBU OS DISTRIBUTION'}</div>
      <div class="logo-sub">Dokumen Resmi Pengiriman / Surat Jalan Logistik</div>
    </div>
    <div class="doc-info">
      <div class="doc-num">${data.sjNumber}</div>
      <div class="doc-date">Tanggal: ${data.date}</div>
    </div>
  </div>

  <div class="title-bar">
    <h2>SURAT JALAN / DOKUMEN PENGIRIMAN</h2>
  </div>

  <div class="grid-2">
    <div class="card-box">
      <span class="label-sm">Pengirim (Distributor / Sub-Gudang)</span>
      <strong>${data.workspaceName || 'TUMBU Distributor'}</strong>
      <div>Unit Armada & Logistik Lapangan</div>
    </div>
    <div class="card-box">
      <span class="label-sm">Penerima / Tujuan Pengiriman</span>
      <strong>${data.customerName}</strong>
      <div>Tujuan: ${data.destination || 'Alamat Lokasi Pembudidaya'}</div>
      <div>Armada: ${data.vehicle || 'Pick Up'} | Driver: ${data.driver || 'Petugas Pengirim'}</div>
    </div>
  </div>

  <table class="pdf-table">
    <thead>
      <tr>
        <th style="width: 40px;">No</th>
        <th>Deskripsi Barang / Ukuran Komoditas</th>
        <th class="text-right" style="width: 120px;">Kuantitas / Jumlah</th>
        <th>Catatan Pengiriman</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((it, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td><strong>${it.itemName}</strong></td>
          <td class="text-right"><strong>${fmtNum(it.quantity)} ${it.unit || 'ekor'}</strong></td>
          <td>${it.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${data.notes ? `
    <div class="card-box" style="margin-bottom: 16px;">
      <span class="label-sm">Catatan Instruksi Pengiriman:</span>
      <div>${data.notes}</div>
    </div>
  ` : ''}

  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
    <div class="badge-stamp">
      ✓ Verifikasi Digital TUMBU OS - Bebas Selisih
    </div>
    <div style="font-family: monospace; font-size: 10px; color: #64748B;">
      Ref ID: TMB-SJ-${data.sjNumber.replace(/\D/g, '') || Date.now()}
    </div>
  </div>

  <div class="signatures">
    <div>
      <div class="label-sm">Diserahkan Oleh (Sopir / Pengirim)</div>
      <div class="sig-line">( ${data.driver || 'Pengirim'} )</div>
    </div>
    <div>
      <div class="label-sm">Diterima Oleh (Pembudidaya / Customer)</div>
      <div class="sig-line">( ${data.customerName} )</div>
    </div>
  </div>

  <div class="footer-note">
    Dokumen ini merupakan bukti pengiriman resmi dari TUMBU Business OS. Dicetak pada ${new Date().toLocaleString('id-ID')}.
  </div>
</body>
</html>`;

  openPrintDocument(`Surat Jalan ${data.sjNumber}`, html, `Surat_Jalan_${data.sjNumber}.pdf`);
}

/** Cetak PDF Berita Acara (BA) Serah Terima Fisik Benih */
export function printBeritaAcaraPdf(data: {
  baNumber: string;
  date: string;
  petaniName: string;
  workspaceName: string;
  komoditas: string;
  sekatanDetails?: Array<{ label: string; awalPetani: number; ulangDistributor: number }>;
  totalAwal: number;
  totalUlang: number;
  susutEkor: number;
  notes?: string;
  pemeriksaName?: string;
}) {
  const details = data.sekatanDetails || [
    { label: 'Sekatan Utama', awalPetani: data.totalAwal, ulangDistributor: data.totalUlang }
  ];

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Berita Acara - ${data.baNumber}</title>
  <style>${pdfBaseStyle}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">${data.workspaceName || 'TUMBU OS DISTRIBUTION'}</div>
      <div class="logo-sub">Berita Acara Pemeriksaan & Hitung Ulang Fisik Benih</div>
    </div>
    <div class="doc-info">
      <div class="doc-num">${data.baNumber}</div>
      <div class="doc-date">Tanggal: ${data.date}</div>
    </div>
  </div>

  <div class="title-bar">
    <h2>BERITA ACARA SERAH TERIMA & HITUNG ULANG</h2>
  </div>

  <div class="grid-2">
    <div class="card-box">
      <span class="label-sm">Pihak Pertama (Petani Penjual / Supplier)</span>
      <strong>${data.petaniName}</strong>
      <div>Komoditas: ${data.komoditas}</div>
    </div>
    <div class="card-box">
      <span class="label-sm">Pihak Kedua (Distributor / QC Receiver)</span>
      <strong>${data.workspaceName || 'Distributor'}</strong>
      <div>Petugas QC: ${data.pemeriksaName || 'Tim Lapangan'}</div>
    </div>
  </div>

  <table class="pdf-table">
    <thead>
      <tr>
        <th>Bagian Sekat Bak / Kantong</th>
        <th class="text-right">Hitungan Awal Petani (Ekor)</th>
        <th class="text-right">Hitung Ulang QC (Ekor)</th>
        <th class="text-right">Selisih / Susut (Ekor)</th>
      </tr>
    </thead>
    <tbody>
      ${details.map(s => {
        const diff = (Number(s.awalPetani) || 0) - (Number(s.ulangDistributor) || 0);
        return `
          <tr>
            <td><strong>${s.label}</strong></td>
            <td class="text-right">${fmtNum(s.awalPetani)}</td>
            <td class="text-right" style="font-weight: 700; color: #16A34A;">${fmtNum(s.ulangDistributor)}</td>
            <td class="text-right" style="color: #D97706;">${diff > 0 ? `-${fmtNum(diff)}` : fmtNum(diff)}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>TOTAL HASIL HITUNG AKHIR</td>
        <td class="text-right">${fmtNum(data.totalAwal)}</td>
        <td class="text-right" style="color: #16A34A; font-size: 13px;">${fmtNum(data.totalUlang)}</td>
        <td class="text-right" style="color: #DC2626;">-${fmtNum(data.susutEkor)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="card-box" style="margin-bottom: 16px;">
    <span class="label-sm">Kondisi Fisik & Catatan QC:</span>
    <div>${data.notes || 'Benih sehat aktif, keseragaman grade A, air aerasi stabil.'}</div>
  </div>

  <div class="signatures">
    <div>
      <div class="label-sm">Pihak Pertama (Petani Penjual)</div>
      <div class="sig-line">( ${data.petaniName} )</div>
    </div>
    <div>
      <div class="label-sm">Pihak Kedua (Petugas QC Distributor)</div>
      <div class="sig-line">( ${data.pemeriksaName || 'Petugas QC'} )</div>
    </div>
  </div>

  <div class="footer-note">
    Dokumen Berita Acara ini diterbitkan secara sah via TUMBU OS. Menjadi acuan dasar pembayaran transaksi.
  </div>
</body>
</html>`;

  openPrintDocument(`Berita Acara ${data.baNumber}`, html, `Berita_Acara_${data.baNumber}.pdf`);
}

/** Cetak PDF Kwitansi Pembayaran */
export function printKwitansiPdf(data: {
  receiptNo: string;
  date: string;
  workspaceName: string;
  payerName: string;
  amount: number;
  description: string;
  paymentMethod: string;
  cashierName?: string;
}) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Kwitansi - ${data.receiptNo}</title>
  <style>${pdfBaseStyle}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">${data.workspaceName || 'TUMBU OS'}</div>
      <div class="logo-sub">Kwitansi Pembayaran Resmi Digital</div>
    </div>
    <div class="doc-info">
      <div class="doc-num">${data.receiptNo}</div>
      <div class="doc-date">Tanggal: ${data.date}</div>
    </div>
  </div>

  <div class="title-bar">
    <h2>KWITANSI PEMBAYARAN</h2>
  </div>

  <table class="pdf-table" style="font-size: 12px; margin-bottom: 20px;">
    <tr>
      <th style="width: 180px;">Telah Diterima Dari</th>
      <td><strong style="font-size: 14px; color: #0F172A;">${data.payerName}</strong></td>
    </tr>
    <tr>
      <th>Uang Sejumlah</th>
      <td>
        <div style="font-size: 18px; font-weight: 800; color: #16A34A; background: #DCFCE7; padding: 6px 12px; border-radius: 6px; display: inline-block;">
          ${fmtRp(data.amount)}
        </div>
      </td>
    </tr>
    <tr>
      <th>Untuk Pembayaran</th>
      <td>${data.description}</td>
    </tr>
    <tr>
      <th>Metode Pembayaran</th>
      <td><strong style="color: #0EA5E9;">${data.paymentMethod}</strong></td>
    </tr>
  </table>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px;">
    <div class="badge-stamp">
      ✓ STAMP VERIFIKASI SAH DIGITAL
    </div>
    <div style="text-align: center; min-width: 180px;">
      <div class="label-sm">Penerima Kasir / Admin</div>
      <div class="sig-line" style="margin-top: 40px;">( ${data.cashierName || 'Kasir Workspace'} )</div>
    </div>
  </div>

  <div class="footer-note">
    Kwitansi digital ini merupakan bukti transaksi yang sah dan diakui oleh sistem TUMBU OS.
  </div>
</body>
</html>`;

  openPrintDocument(`Kwitansi ${data.receiptNo}`, html, `Kwitansi_${data.receiptNo}.pdf`);
}

/** Cetak PDF Laporan Tutup Buku / Closing Period */
export function printClosingReportPdf(data: {
  periodLabel: string;
  date: string;
  workspaceName: string;
  totalPenjualan: number;
  totalPembelian: number;
  totalBiayaOperasional: number;
  labaRugiBersih: number;
  kasAwal?: number;
  kasAkhir?: number;
  saldoBank?: number;
  piutangPelanggan?: number;
  hutangSupplier?: number;
  notes?: string;
  auditorName?: string;
}) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Laporan Tutup Buku - ${data.periodLabel}</title>
  <style>${pdfBaseStyle}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">${data.workspaceName || 'TUMBU BUSINESS OS'}</div>
      <div class="logo-sub">Laporan Closing & Rekonsiliasi Keuangan Periodik</div>
    </div>
    <div class="doc-info">
      <div class="doc-num">CLOSING-${data.periodLabel}</div>
      <div class="doc-date">Tanggal Closing: ${data.date}</div>
    </div>
  </div>

  <div class="title-bar">
    <h2>LAPORAN TUTUP BUKU PERIODE ${data.periodLabel}</h2>
  </div>

  <div class="card-box" style="margin-bottom: 16px; background: #EFF6FF; border-color: #BFDBFE;">
    <span class="label-sm" style="color: #1E40AF;">Ringkasan Eksekutif Keuangan</span>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
      <span style="font-size: 14px; font-weight: 700; color: #1E3A8A;">HASIL LABA / RUGI BERSIH:</span>
      <span style="font-size: 18px; font-weight: 800; color: ${data.labaRugiBersih >= 0 ? '#16A34A' : '#DC2626'};">
        ${fmtRp(data.labaRugiBersih)}
      </span>
    </div>
  </div>

  <table class="pdf-table">
    <thead>
      <tr>
        <th>Komponen Laporan Keuangan</th>
        <th class="text-right">Nominal (Rupiah)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Total Pemasukan Penjualan (Revenue)</strong></td>
        <td class="text-right" style="font-weight: 700; color: #16A34A;">${fmtRp(data.totalPenjualan)}</td>
      </tr>
      <tr>
        <td>Total Kulakan / Pembelian (HPP)</td>
        <td class="text-right" style="color: #DC2626;">- ${fmtRp(data.totalPembelian)}</td>
      </tr>
      <tr>
        <td>Total Biaya Operasional (Expenses)</td>
        <td class="text-right" style="color: #DC2626;">- ${fmtRp(data.totalBiayaOperasional)}</td>
      </tr>
      <tr style="background: #F8FAFC; font-weight: 800;">
        <td><strong>LABA BERSIH OPERASIONAL</strong></td>
        <td class="text-right" style="font-size: 13px; color: ${data.labaRugiBersih >= 0 ? '#16A34A' : '#DC2626'};">
          ${fmtRp(data.labaRugiBersih)}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="title-bar" style="margin-top: 20px;">
    <h2 style="font-size: 14px;">POSISI NERACA & SALDO AKHIR</h2>
  </div>

  <table class="pdf-table">
    <thead>
      <tr>
        <th>Akun Kas / Posisi Aset</th>
        <th class="text-right">Saldo / Nilai</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Saldo Kas Tunai Akhir</td>
        <td class="text-right"><strong>${fmtRp(data.kasAkhir || 0)}</strong></td>
      </tr>
      <tr>
        <td>Saldo Rekening Bank</td>
        <td class="text-right"><strong>${fmtRp(data.saldoBank || 0)}</strong></td>
      </tr>
      <tr>
        <td>Piutang Pelanggan (Belum Tertagih)</td>
        <td class="text-right" style="color: #D97706;">${fmtRp(data.piutangPelanggan || 0)}</td>
      </tr>
      <tr>
        <td>Hutang Ke Supplier (Belum Lunas)</td>
        <td class="text-right" style="color: #DC2626;">${fmtRp(data.hutangSupplier || 0)}</td>
      </tr>
    </tbody>
  </table>

  ${data.notes ? `
    <div class="card-box" style="margin-bottom: 16px;">
      <span class="label-sm">Catatan Auditor / Manager:</span>
      <div>${data.notes}</div>
    </div>
  ` : ''}

  <div class="signatures">
    <div>
      <div class="label-sm">Dibuat Oleh (Kasir / Staff Finance)</div>
      <div class="sig-line">( Staff Keuangan )</div>
    </div>
    <div>
      <div class="label-sm">Disetujui Oleh (Owner / Platform Master)</div>
      <div class="sig-line">( ${data.auditorName || 'Owner Workspace'} )</div>
    </div>
  </div>

  <div class="footer-note">
    Laporan Tutup Buku ini dibuat secara otomatis oleh TUMBU Business OS dan telah terkunci secara permanen untuk periode bersangkutan.
  </div>
</body>
</html>`;

  openPrintDocument(`Laporan Tutup Buku ${data.periodLabel}`, html, `Laporan_Tutup_Buku_${data.periodLabel}.pdf`);
}

