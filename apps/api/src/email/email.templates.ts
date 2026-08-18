import type { EmailKind, EmailSendInput } from './email.types';
import { appOrigin, formatExpiresId, publicAssetUrl } from './email.types';

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const BRAND = 'TUMBU Business Operating System';
const HELP = 'halo@tumbu.web.id';
const NAVY = '#0A2E63';
const GREEN = '#1E9E43';
const SLATE = '#64748B';

function money(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoUrl(): string {
  return publicAssetUrl('/tumbu-logo-light.svg');
}

function logoMarkUrl(): string {
  return publicAssetUrl('/tumbu-logo.svg');
}

/** Simple inline SVG illustration (email clients that block remote images still see something). */
function heroIllustration(kind: 'verify' | 'reset' | 'ok' | 'bill' | 'warn'): string {
  const icons: Record<string, string> = {
    verify: `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="#E8F7EE"/>
      <path d="M18 28h36v24a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V28z" fill="#fff" stroke="${GREEN}" stroke-width="2"/>
      <path d="M18 28l18 12 18-12" fill="none" stroke="${GREEN}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="52" cy="22" r="10" fill="${GREEN}"/>
      <path d="M47 22l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,
    reset: `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="#E8EEF7"/>
      <rect x="24" y="30" width="24" height="20" rx="4" fill="#fff" stroke="${NAVY}" stroke-width="2"/>
      <path d="M28 30v-4a8 8 0 0 1 16 0v4" fill="none" stroke="${NAVY}" stroke-width="2.5"/>
      <circle cx="36" cy="40" r="2.5" fill="${GREEN}"/>
    </svg>`,
    ok: `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="#E8F7EE"/>
      <circle cx="36" cy="36" r="16" fill="${GREEN}"/>
      <path d="M28 36l5 5 11-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    bill: `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="#EEF2FF"/>
      <rect x="20" y="16" width="32" height="40" rx="4" fill="#fff" stroke="${NAVY}" stroke-width="2"/>
      <path d="M26 26h20M26 34h20M26 42h12" stroke="${SLATE}" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    warn: `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="#FEF3C7"/>
      <path d="M36 18l18 34H18L36 18z" fill="#fff" stroke="#D97706" stroke-width="2"/>
      <path d="M36 30v10" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
      <circle cx="36" cy="46" r="2" fill="#D97706"/>
    </svg>`,
  };
  return `<div style="text-align:center;margin:0 0 20px;">${icons[kind]}</div>`;
}

function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto;">
  <tr><td align="center" bgcolor="${GREEN}" style="border-radius:12px;background:${GREEN};">
    <a href="${escapeHtml(href)}"
       style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
      ${escapeHtml(label)}
    </a>
  </td></tr>
</table>
<p style="margin:0 0 8px;font-size:13px;color:${SLATE};text-align:center;">Jika tombol tidak bekerja, salin dan buka tautan berikut di browser:</p>
<p style="margin:0 0 20px;font-size:12px;color:${NAVY};word-break:break-all;text-align:center;line-height:1.5;">
  <a href="${escapeHtml(href)}" style="color:${GREEN};">${escapeHtml(href)}</a>
</p>`;
}

function expiryBox(expiresAt?: string): string {
  const label = formatExpiresId(expiresAt);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
  <tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;">
    <table role="presentation" width="100%"><tr>
      <td width="36" valign="top" style="font-size:22px;line-height:1;">⏱</td>
      <td style="font-size:13px;color:#334155;line-height:1.5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        <strong style="display:block;color:${NAVY};margin-bottom:2px;">Tautan berlaku hingga</strong>
        ${escapeHtml(label)} (WIB)
      </td>
    </tr></table>
  </td></tr>
</table>`;
}

function layout(opts: {
  subject: string;
  preheader: string;
  title: string;
  illustration: 'verify' | 'reset' | 'ok' | 'bill' | 'warn';
  bodyHtml: string;
  bodyText: string;
}): RenderedEmail {
  const origin = appOrigin();
  const year = new Date().getFullYear();
  const logo = logoUrl();
  const mark = logoMarkUrl();

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>${escapeHtml(opts.subject)}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .pg { background:#0B1220 !important; }
      .card { background:#111827 !important; border-color:#1F2937 !important; }
      .body-text, .body-text p, .body-text li { color:#E5E7EB !important; }
      .muted { color:#9CA3AF !important; }
      .expiry { background:#1F2937 !important; border-color:#374151 !important; }
    }
  </style>
</head>
<body class="pg" style="margin:0;padding:0;background:#EEF2F7;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(opts.preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="pg" style="background:#EEF2F7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" class="card" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 12px 40px rgba(10,46,99,.08);">
        <tr>
          <td style="background:${NAVY};padding:22px 28px;">
            <table role="presentation" width="100%"><tr>
              <td valign="middle" width="48">
                <img src="${escapeHtml(logo)}" width="40" height="40" alt="TUMBU" style="display:block;border:0;outline:none;width:40px;height:40px;"/>
              </td>
              <td valign="middle" style="padding-left:12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;line-height:1.1;">TUMBU</div>
                <div style="font-size:12px;color:#AFC3E0;margin-top:3px;font-weight:500;">Business Operating System</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td class="body-text" style="padding:32px 28px 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0F172A;font-size:15px;line-height:1.65;">
            ${heroIllustration(opts.illustration)}
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${NAVY};font-weight:800;letter-spacing:-0.02em;">${escapeHtml(opts.title)}</h1>
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;border-top:1px solid #E2E8F0;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%"><tr>
              <td valign="middle" width="28">
                <img src="${escapeHtml(mark)}" width="24" height="24" alt="" style="display:block;border:0;width:24px;height:24px;"/>
              </td>
              <td class="muted" style="padding-left:10px;font-size:12px;color:${SLATE};line-height:1.55;">
                Butuh bantuan?<br/>
                <a href="mailto:${HELP}" style="color:${GREEN};font-weight:700;text-decoration:none;">${HELP}</a>
              </td>
            </tr></table>
            <p class="muted" style="margin:16px 0 0;font-size:11px;color:#94A3B8;line-height:1.5;text-align:center;">
              Powered by<br/><strong style="color:${NAVY};">${escapeHtml(BRAND)}</strong><br/>
              © ${year} TUMBU · <a href="${escapeHtml(origin)}" style="color:${SLATE};">${escapeHtml(origin.replace(/^https:\/\//, ''))}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${opts.title}

${opts.bodyText}

Butuh bantuan? ${HELP}
Powered by ${BRAND}
${origin}
© ${year} TUMBU
`;
  return { subject: opts.subject, html, text };
}

export function renderEmail(input: EmailSendInput): RenderedEmail {
  const origin = appOrigin();
  const name = input.name?.trim() || 'Pengguna';
  const kind: EmailKind = input.kind;

  switch (kind) {
    case 'EMAIL_VERIFY': {
      const link = `${origin}/?verify=${encodeURIComponent(input.token || '')}`;
      return layout({
        subject: 'Verifikasi email akun TUMBU',
        preheader: 'Satu klik untuk mengamankan akun TUMBU Anda.',
        title: 'Verifikasi email Anda',
        illustration: 'verify',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 12px;">Terima kasih telah mendaftar di TUMBU.</p>
          <p style="margin:0 0 8px;">Untuk mengamankan akun Anda, silakan verifikasi alamat email dengan menekan tombol di bawah ini.</p>
          ${ctaButton(link, 'Verifikasi Email Saya')}
          ${expiryBox(input.expiresAt)}
          <p class="muted" style="margin:16px 0 0;font-size:13px;color:${SLATE};">Abaikan email ini jika Anda tidak mendaftar di TUMBU.</p>`,
        bodyText: `Halo ${name},\n\nTerima kasih telah mendaftar di TUMBU.\nVerifikasi email: ${link}\nBerlaku hingga: ${formatExpiresId(input.expiresAt)}\n\nAbaikan jika Anda tidak mendaftar.`,
      });
    }
    case 'PASSWORD_RESET': {
      const link = `${origin}/?reset=${encodeURIComponent(input.token || '')}`;
      return layout({
        subject: 'Reset kata sandi TUMBU',
        preheader: 'Atur ulang kata sandi akun TUMBU Anda.',
        title: 'Atur kata sandi baru',
        illustration: 'reset',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 12px;">Kami menerima permintaan untuk mereset kata sandi akun TUMBU Anda.</p>
          <p style="margin:0 0 8px;">Tekan tombol di bawah untuk membuat kata sandi baru. Jika Anda tidak meminta reset, abaikan email ini.</p>
          ${ctaButton(link, 'Atur Kata Sandi Baru')}
          ${expiryBox(input.expiresAt)}`,
        bodyText: `Halo ${name},\n\nReset kata sandi: ${link}\nBerlaku hingga: ${formatExpiresId(input.expiresAt)}\n\nAbaikan jika Anda tidak meminta reset.`,
      });
    }
    case 'PASSWORD_RESET_DONE':
      return layout({
        subject: 'Kata sandi TUMBU berhasil diubah',
        preheader: 'Kata sandi akun Anda telah diperbarui.',
        title: 'Kata sandi berhasil diperbarui',
        illustration: 'ok',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 8px;">Kata sandi akun TUMBU Anda sudah diperbarui. Silakan masuk dengan kata sandi baru.</p>
          ${ctaButton(origin, 'Masuk ke TUMBU')}
          <p class="muted" style="margin:16px 0 0;font-size:13px;color:${SLATE};">Jika ini bukan Anda, segera hubungi ${HELP}.</p>`,
        bodyText: `Halo ${name},\n\nKata sandi Anda telah diperbarui.\nMasuk: ${origin}\nJika bukan Anda, hubungi ${HELP}.`,
      });
    case 'WELCOME':
      return layout({
        subject: 'Selamat datang di TUMBU',
        preheader: 'Akun TUMBU Anda siap digunakan.',
        title: 'Selamat datang di TUMBU',
        illustration: 'ok',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 12px;">Terima kasih telah bergabung dengan <strong>TUMBU Business Operating System</strong>.</p>
          <p style="margin:0 0 8px;">Verifikasi email Anda (jika belum), lalu mulai kelola usaha perikanan dengan lebih rapi dan terhubung.</p>
          ${ctaButton(origin, 'Buka TUMBU')}`,
        bodyText: `Halo ${name},\n\nSelamat datang di TUMBU.\nBuka: ${origin}`,
      });
    case 'INVOICE_CREATED':
      return layout({
        subject: `Tagihan baru ${input.invoiceNumber || ''}`.trim() || 'Tagihan baru TUMBU',
        preheader: 'Tagihan langganan TUMBU telah diterbitkan.',
        title: 'Tagihan baru siap dibayar',
        illustration: 'bill',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 12px;">Tagihan langganan untuk usaha <strong>${escapeHtml(input.workspaceName || 'Anda')}</strong> telah diterbitkan.</p>
          <ul style="padding-left:18px;line-height:1.8;margin:0 0 8px;">
            <li>Nomor: <strong>${escapeHtml(input.invoiceNumber || '—')}</strong></li>
            <li>Nominal: <strong>${escapeHtml(money(input.amount))}</strong></li>
            <li>Jatuh tempo: <strong>${escapeHtml(input.dueAt || '—')}</strong></li>
          </ul>
          ${ctaButton(origin, 'Lihat Tagihan')}`,
        bodyText: `Tagihan ${input.invoiceNumber || ''}\nUsaha: ${input.workspaceName || '—'}\nNominal: ${money(input.amount)}\nJatuh tempo: ${input.dueAt || '—'}\n${origin}`,
      });
    case 'PAYMENT_SUCCESS':
      return layout({
        subject: `Pembayaran berhasil — ${input.invoiceNumber || 'tagihan'}`,
        preheader: 'Pembayaran tagihan TUMBU berhasil diterima.',
        title: 'Pembayaran berhasil',
        illustration: 'ok',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 8px;">Pembayaran untuk tagihan <strong>${escapeHtml(input.invoiceNumber || '')}</strong> (${escapeHtml(money(input.amount))}) telah kami terima. Terima kasih.</p>
          ${ctaButton(origin, 'Buka TUMBU')}`,
        bodyText: `Pembayaran berhasil.\nInvoice: ${input.invoiceNumber || '—'}\nNominal: ${money(input.amount)}\n${origin}`,
      });
    case 'PAYMENT_FAILED':
      return layout({
        subject: `Pembayaran gagal — ${input.invoiceNumber || 'tagihan'}`,
        preheader: 'Pembayaran tagihan TUMBU tidak berhasil.',
        title: 'Pembayaran belum berhasil',
        illustration: 'warn',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 8px;">Pembayaran untuk tagihan <strong>${escapeHtml(input.invoiceNumber || '')}</strong> tidak berhasil diproses. Silakan coba lagi atau hubungi dukungan.</p>
          ${ctaButton(origin, 'Coba Bayar Lagi')}`,
        bodyText: `Pembayaran gagal.\nInvoice: ${input.invoiceNumber || '—'}\n${origin}`,
      });
    case 'TRIAL_REMINDER':
      return layout({
        subject: 'Pengingat masa uji coba TUMBU',
        preheader: 'Masa uji coba usaha Anda akan segera berakhir.',
        title: 'Masa uji coba hampir habis',
        illustration: 'warn',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 8px;">Masa uji coba usaha <strong>${escapeHtml(input.workspaceName || 'Anda')}</strong> akan berakhir pada <strong>${escapeHtml(formatExpiresId(input.trialEndsAt || undefined))}</strong>. Segera lengkapi langganan agar operasional tidak terhenti.</p>
          ${ctaButton(origin, 'Kelola Langganan')}`,
        bodyText: `Trial berakhir: ${formatExpiresId(input.trialEndsAt || undefined)}\nUsaha: ${input.workspaceName || '—'}\n${origin}`,
      });
    case 'SUBSCRIPTION_EXPIRED':
      return layout({
        subject: 'Langganan / trial TUMBU telah berakhir',
        preheader: 'Akses operasional dibatasi hingga tagihan diselesaikan.',
        title: 'Akses operasional dibatasi',
        illustration: 'warn',
        bodyHtml: `
          <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 8px;">Akses operasional untuk usaha <strong>${escapeHtml(input.workspaceName || 'Anda')}</strong> dibatasi karena masa trial/langganan berakhir. Selesaikan tagihan untuk melanjutkan.</p>
          ${ctaButton(origin, 'Selesaikan Tagihan')}`,
        bodyText: `Langganan/trial berakhir.\nUsaha: ${input.workspaceName || '—'}\n${origin}`,
      });
    default: {
      const _exhaustive: never = kind;
      return layout({
        subject: 'Notifikasi TUMBU',
        preheader: 'Notifikasi TUMBU',
        title: 'Notifikasi',
        illustration: 'ok',
        bodyHtml: `<p>${escapeHtml(String(_exhaustive))}</p>`,
        bodyText: String(_exhaustive),
      });
    }
  }
}
