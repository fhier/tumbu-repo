/** Centralized transactional email kinds for TUMBU. */

export type EmailKind =
  | 'EMAIL_VERIFY'
  | 'PASSWORD_RESET'
  | 'PASSWORD_RESET_DONE'
  | 'WELCOME'
  | 'INVOICE_CREATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'TRIAL_REMINDER'
  | 'SUBSCRIPTION_EXPIRED';

export type EmailSendInput = {
  kind: EmailKind;
  to: string;
  /** Display name for templates */
  name?: string;
  /** Opaque token for verify/reset links */
  token?: string;
  expiresAt?: string;
  workspaceName?: string;
  invoiceNumber?: string;
  amount?: number;
  dueAt?: string | null;
  trialEndsAt?: string | null;
  extra?: Record<string, string | number | null | undefined>;
};

export type EmailSendResult = {
  channel: 'resend';
  accepted: boolean;
  message?: string;
  providerId?: string;
};

const FORBIDDEN_HOST =
  /(trycloudflare\.com|localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;

/**
 * Canonical public app URL for ALL email links.
 * Never uses request host, CORS list, or temporary tunnels.
 */
export function appOrigin(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
  ];
  for (const raw of candidates) {
    const v = String(raw || '').trim().replace(/\/$/, '');
    if (!v) continue;
    if (FORBIDDEN_HOST.test(v)) continue;
    if (!/^https:\/\//i.test(v)) continue;
    return v;
  }
  return 'https://tumbu.web.id';
}

/** Absolute URL to a public web asset (logo, etc.). */
export function publicAssetUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${appOrigin()}${p}`;
}

export function maskEmail(email: string): string {
  const [u, d] = String(email || '').split('@');
  if (!d) return '***';
  const user = u.length <= 2 ? `${u[0] || '*'}*` : `${u.slice(0, 2)}***`;
  return `${user}@${d}`;
}

export function formatExpiresId(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}
