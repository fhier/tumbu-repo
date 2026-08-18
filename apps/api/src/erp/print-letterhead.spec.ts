import {
  buildPrintLetterheadHtml,
  printLetterheadCss,
  resolveLetterheadMode,
} from './print-letterhead';

describe('print-letterhead', () => {
  const esc = (v: unknown) => String(v ?? '');

  it('renders structured kop with logo slot and identity', () => {
    const html = buildPrintLetterheadHtml(
      {
        name: 'Mina Alam Tani',
        tagline: 'Distributor Bibit Ikan Unggul',
        address: 'Jl. Contoh No. 1, Bandung',
        phone: '08123456789',
        logoUrl: 'data:image/png;base64,abc',
        bankName: 'BCA',
        bankAccount: '1234567890',
        letterheadMode: 'template',
      },
      esc,
    );
    expect(html).toContain('tumbu-kop-template');
    expect(html).toContain('Mina Alam Tani');
    expect(html).toContain('Distributor Bibit Ikan Unggul');
    expect(html).toContain('Telp:</b> 08123456789');
    expect(html).toContain('Rek:</b> BCA · 1234567890');
    expect(html).toContain('tumbu-kop-rule-main');
    expect(html).toContain('tumbu-kop-table');
  });

  it('renders custom banner full-width img block', () => {
    const html = buildPrintLetterheadHtml(
      {
        name: 'Mina Alam Tani',
        letterheadUrl: 'data:image/png;base64,banner',
        letterheadMode: 'custom',
      },
      esc,
    );
    expect(html).toContain('print-header-custom');
    expect(html).toContain('print-banner-img');
    expect(html).toContain('src="data:image/png;base64,banner"');
    expect(html).toContain('Kop Surat Utuh');
    expect(html).not.toContain('letterhead-banner-container');
    expect(html).not.toContain('tumbu-kop-table');
    expect(resolveLetterheadMode({
      letterheadMode: 'custom',
      letterheadUrl: 'x',
      name: 'A',
    })).toBe('custom');
  });

  it('falls back to template when custom mode but no banner image', () => {
    expect(resolveLetterheadMode({
      letterheadMode: 'custom',
      letterheadUrl: '',
      name: 'A',
    })).toBe('template');
  });

  it('exports full-width banner css (no max-height contain shrink)', () => {
    const css = printLetterheadCss();
    expect(css).toContain('.print-header-custom');
    expect(css).toContain('.print-banner-img');
    expect(css).toContain('.invoice-container');
    expect(css).toContain('width:100%!important');
    expect(css).toContain('height:auto!important');
    expect(css).not.toMatch(/\.print-banner-img\{[^}]*object-fit/);
    expect(css).not.toMatch(/\.print-banner-img\{[^}]*max-height/);
  });
});
