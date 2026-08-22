import { timingSafeEqual, createHmac } from 'crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  PaymentProvider,
  WebhookVerification,
} from '../payment.types';

function timingSafeStringEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Xendit Invoice API (QRIS/VA via hosted invoice).
 * Auth: Basic secret_key:
 * Webhook: header `x-callback-token` must match XENDIT_CALLBACK_TOKEN.
 * Docs: https://developers.xendit.co/api-reference/#create-invoice
 */
export class XenditPaymentAdapter implements PaymentProvider {
  readonly code = 'xendit';

  private secretKey() {
    return (process.env.XENDIT_SECRET_KEY || '').trim();
  }

  private callbackToken() {
    return (process.env.XENDIT_CALLBACK_TOKEN || '').trim();
  }

  private apiBase() {
    return (process.env.XENDIT_API_BASE || 'https://api.xendit.co').replace(/\/$/, '');
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const secret = this.secretKey();
    if (!secret) {
      throw new Error('XENDIT_SECRET_KEY belum dikonfigurasi.');
    }
    const externalId = `tumbu_${input.invoiceId}`;
    const body: Record<string, unknown> = {
      external_id: externalId,
      amount: Math.round(input.amount),
      description: input.description.slice(0, 255),
      currency: input.currency || 'IDR',
      invoice_duration: 86400 * 2,
    };
    if (input.customerEmail) {
      body.payer_email = input.customerEmail;
    }
    if (input.customerName) {
      body.customer = { given_names: input.customerName };
    }
    if (input.successRedirectUrl) body.success_redirect_url = input.successRedirectUrl;
    if (input.failureRedirectUrl) body.failure_redirect_url = input.failureRedirectUrl;

    const auth = Buffer.from(`${secret}:`).toString('base64');
    const res = await fetch(`${this.apiBase()}/v2/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Xendit response bukan JSON (${res.status})`);
    }
    if (!res.ok) {
      const msg = String(data.message || data.error_code || text || res.status);
      throw new Error(`Xendit create invoice gagal: ${msg}`);
    }
    return {
      provider: this.code,
      externalId: String(data.external_id || externalId),
      providerRef: String(data.id || ''),
      checkoutUrl: data.invoice_url ? String(data.invoice_url) : null,
      channel: 'XENDIT_INVOICE',
      raw: data,
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): WebhookVerification {
    const expected = this.callbackToken();
    if (!expected) {
      return { valid: false, reason: 'XENDIT_CALLBACK_TOKEN belum dikonfigurasi' };
    }

    // 1. Modern HMAC-SHA256 Verification (Xendit Webhook Signature)
    const hmacHeader = headerVal(headers, 'xendit-webhook-signature') || headerVal(headers, 'x-webhook-signature') || headerVal(headers, 'webhook-signature');
    if (hmacHeader) {
      const expectedHmac = createHmac('sha256', expected).update(rawBody, 'utf8').digest('hex');
      if (timingSafeStringEqual(hmacHeader, expectedHmac)) {
        return { valid: true };
      }
      return { valid: false, reason: 'HMAC webhook signature tidak valid' };
    }

    // 2. Legacy Fallback (x-callback-token)
    const got = headerVal(headers, 'x-callback-token');
    if (!got) return { valid: false, reason: 'Header webhook signature / x-callback-token wajib' };
    if (!timingSafeStringEqual(got, expected)) return { valid: false, reason: 'x-callback-token tidak valid' };
    return { valid: true };
  }

  parseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): NormalizedWebhookEvent {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody || '{}');
    } catch {
      throw new Error('Body webhook Xendit bukan JSON');
    }
    const externalId = String(body.external_id || '');
    const providerRef = body.id ? String(body.id) : undefined;
    // Prefer id+status+updated as event uniqueness; fallback compose
    const eventId = String(
      body.id && body.status
        ? `${body.id}:${body.status}:${body.paid_at || body.updated || body.created || ''}`
        : body.event_id || '',
    );
    if (!externalId || !eventId) {
      throw new Error('Webhook Xendit wajib external_id dan id/status');
    }
    const statusRaw = String(body.status || '').toUpperCase();
    let status: NormalizedWebhookEvent['status'] = 'UNKNOWN';
    if (statusRaw === 'PAID' || statusRaw === 'SETTLED') status = 'PAID';
    else if (statusRaw === 'PENDING' || statusRaw === 'ACTIVE') status = 'PENDING';
    else if (statusRaw === 'EXPIRED') status = 'EXPIRED';
    else if (statusRaw === 'FAILED') status = 'FAILED';

    return {
      eventId,
      externalId,
      providerRef,
      status,
      paidAmount: body.paid_amount !== undefined ? Number(body.paid_amount) : undefined,
      raw: body,
    };
  }
}

function headerVal(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0] || '');
  return v ? String(v) : '';
}
