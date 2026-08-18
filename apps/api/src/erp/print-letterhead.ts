/**
 * SSOT template kop surat — format surat resmi Indonesia.
 * Mode template: logo kiri + identitas kanan + garis ganda.
 * Mode custom: banner full-width sejajar isi dokumen (width:100%, height:auto).
 */

export type LetterheadMode = 'template' | 'custom';

export type PrintLetterheadInput = {
  name: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string;
  /** Gambar kop utuh (banner) — dipakai saat letterheadMode=custom */
  letterheadUrl?: string;
  letterheadMode?: LetterheadMode;
  tagline?: string;
  bankName?: string;
  bankAccount?: string;
};

export type HtmlEscaper = (value: unknown) => string;

export function resolveLetterheadMode(input: PrintLetterheadInput): LetterheadMode {
  if (
    input.letterheadMode === 'custom'
    && String(input.letterheadUrl || '').trim()
  ) {
    return 'custom';
  }
  return 'template';
}

export function printLetterheadCss(): string {
  return `@page{size:A4 portrait;margin:14mm 12mm 14mm 12mm}
.invoice-container{width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:0}
.tumbu-kop{width:100%;margin:0 0 8px;padding:0;box-sizing:border-box;page-break-inside:avoid;break-inside:avoid}
.tumbu-kop-table{width:100%;border-collapse:collapse;border:0}
.tumbu-kop-logo-cell{width:96px;vertical-align:middle;padding:0 20px 0 0}
.tumbu-kop-logo-cell img{display:block;max-width:88px;max-height:72px;width:auto;height:auto;object-fit:contain}
.tumbu-kop-logo-cell .initial{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:#F0F4FA;color:#0D1B3D;font-size:26px;font-weight:800;letter-spacing:.02em}
.tumbu-kop-identity-cell{vertical-align:middle;text-align:left}
.tumbu-kop-name{margin:0 0 3px;font-size:19px;font-weight:800;color:#0D1B3D;line-height:1.2;letter-spacing:.04em;text-transform:uppercase}
.tumbu-kop-tagline{margin:0 0 6px;font-size:11px;font-weight:500;font-style:italic;color:#475569;line-height:1.35}
.tumbu-kop-contact{margin:0;font-size:10px;color:#64748B;line-height:1.5}
.tumbu-kop-contact b{font-weight:600;color:#334155}
.tumbu-kop-rules{margin-top:10px}
.tumbu-kop-rule-main{height:2.5px;background:#0D1B3D;width:100%}
.tumbu-kop-rule-sub{height:1px;background:#16A34A;width:100%;margin-top:3px}
.tumbu-kop-template{max-height:120px;overflow:hidden}
.print-header-custom{width:100%!important;max-width:100%!important;margin:0 0 16px 0!important;padding:0!important;box-sizing:border-box!important;text-align:center;line-height:0;overflow:visible}
.print-banner-img{width:100%!important;max-width:100%!important;height:auto!important;display:block!important;margin:0!important;padding:0!important;border:0;vertical-align:top;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-head,.head{clear:both;width:100%;box-sizing:border-box}
.doc-head{margin:16px 0 14px;padding:0}
.doc-head h1{margin:0 0 4px;font-size:19px;font-weight:800;color:#0D1B3D;letter-spacing:.01em}
.doc-head .subjudul{font-size:11.5px;color:#64748B;font-style:italic;margin:0}
@media print{
  body{padding:0!important;margin:0!important}
  .tumbu-kop{margin:0 0 4mm;padding:0}
  .tumbu-kop-rule-main,.tumbu-kop-rule-sub{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-header-custom{margin:0 0 5mm 0!important;padding:0!important}
  .print-banner-img{width:100%!important;height:auto!important}
}`;
}

function buildTemplateLetterheadHtml(
  input: PrintLetterheadInput,
  esc: HtmlEscaper,
): string {
  const name = String(input.name || '').trim() || 'Usaha';
  const tagline = String(input.tagline || '').trim();
  const address = String(input.address || '').trim();
  const phone = String(input.phone || '').trim();
  const bankName = String(input.bankName || '').trim();
  const bankAccount = String(input.bankAccount || '').trim();

  const logoUrl = String(input.logoUrl || '').trim();
  const logoCell = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="" />`
    : `<span class="initial">${esc(name.slice(0, 1).toUpperCase() || 'U')}</span>`;

  const taglineHtml = tagline
    ? `<p class="tumbu-kop-tagline">${esc(tagline)}</p>`
    : '';

  const contactParts: string[] = [];
  if (address) {
    contactParts.push(`<b>Alamat:</b> ${esc(address)}`);
  }
  if (phone) {
    contactParts.push(`<b>Telp:</b> ${esc(phone)}`);
  }
  if (bankName || bankAccount) {
    contactParts.push(
      `<b>Rek:</b> ${esc([bankName, bankAccount].filter(Boolean).join(' · '))}`,
    );
  }
  const contactHtml = contactParts.length
    ? `<p class="tumbu-kop-contact">${contactParts.join(' &nbsp;|&nbsp; ')}</p>`
    : '';

  return `<header class="tumbu-kop tumbu-kop-template" role="banner">
  <table class="tumbu-kop-table" role="presentation"><tr>
    <td class="tumbu-kop-logo-cell">${logoCell}</td>
    <td class="tumbu-kop-identity-cell">
      <h1 class="tumbu-kop-name">${esc(name)}</h1>
      ${taglineHtml}
      ${contactHtml}
    </td>
  </tr></table>
  <div class="tumbu-kop-rules" aria-hidden="true">
    <div class="tumbu-kop-rule-main"></div>
    <div class="tumbu-kop-rule-sub"></div>
  </div>
</header>`;
}

function buildCustomBannerLetterheadHtml(
  input: PrintLetterheadInput,
  esc: HtmlEscaper,
): string {
  const banner = String(input.letterheadUrl || '').trim();
  return `<div class="print-header-custom">
  <img class="print-banner-img" src="${esc(banner)}" alt="Kop Surat Utuh" />
</div>`;
}

export function buildPrintLetterheadHtml(
  input: PrintLetterheadInput,
  esc: HtmlEscaper,
): string {
  return resolveLetterheadMode(input) === 'custom'
    ? buildCustomBannerLetterheadHtml(input, esc)
    : buildTemplateLetterheadHtml(input, esc);
}
