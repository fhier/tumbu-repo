import { createHmac, timingSafeEqual } from 'crypto';
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

function headerVal(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0] || '');
  return v ? String(v) : '';
}

/**
 * Local/CI adapter — no network. Signature: HMAC-SHA256(rawBody, STUB_WEBHOOK_SECRET)
 * header `x-stub-signature` = hex digest. Or shared token `x-stub-token`.
 */
export class StubPaymentAdapter implements PaymentProvider {
  readonly code = 'stub';

  private secret() {
    return process.env.STUB_WEBHOOK_SECRET || 'stub-dev-secret';
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const externalId = `stub_${input.invoiceId}`;
    const providerRef = `stub_ref_${input.invoiceNumber}_${Date.now().toString(36)}`;
    const base = (process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3011')
      .split(',')[0]
      .trim();
    return {
      provider: this.code,
      externalId,
      providerRef,
      channel: input.channel || 'STUB',
      checkoutUrl: `${base}/pay/stub?externalId=${encodeURIComponent(externalId)}&amount=${input.amount}`,
      raw: { stub: true, amount: input.amount },
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): WebhookVerification {
    const token = headerVal(headers, 'x-stub-token');
    if (token) {
      const expected = this.secret();
      if (timingSafeStringEqual(token, expected)) return { valid: true };
      return { valid: false, reason: 'x-stub-token tidak valid' };
    }
    const sig = headerVal(headers, 'x-stub-signature');
    if (!sig) return { valid: false, reason: 'Signature stub wajib (x-stub-signature atau x-stub-token)' };
    const expected = createHmac('sha256', this.secret()).update(rawBody, 'utf8').digest('hex');
    if (!timingSafeStringEqual(sig, expected)) return { valid: false, reason: 'x-stub-signature tidak valid' };
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
      throw new Error('Body webhook stub bukan JSON');
    }
    const externalId = String(body.externalId || body.external_id || '');
    const eventId = String(body.eventId || body.event_id || body.id || '');
    if (!externalId || !eventId) throw new Error('Webhook stub wajib eventId dan externalId');
    const statusRaw = String(body.status || 'UNKNOWN').toUpperCase();
    const status =
      statusRaw === 'PAID' || statusRaw === 'PENDING' || statusRaw === 'EXPIRED' || statusRaw === 'FAILED'
        ? statusRaw
        : 'UNKNOWN';
    return {
      eventId,
      externalId,
      providerRef: body.providerRef ? String(body.providerRef) : undefined,
      status,
      paidAmount: body.paidAmount !== undefined ? Number(body.paidAmount) : undefined,
      raw: body,
    };
  }
}
