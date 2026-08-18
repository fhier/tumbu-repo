/** Payment Gateway — provider-agnostic contracts. Billing never imports vendor SDKs. */

export type CreatePaymentInput = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: 'IDR';
  description: string;
  customerEmail?: string;
  customerName?: string;
  /** Preferred channel hint — adapter may map to QRIS/VA/invoice. */
  channel?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
};

export type CreatePaymentResult = {
  provider: string;
  /** Our external_id sent to provider (stable for reconciliation). */
  externalId: string;
  /** Provider-native id (Xendit invoice id, etc.). */
  providerRef: string;
  checkoutUrl?: string | null;
  channel?: string | null;
  raw?: unknown;
};

export type WebhookVerification = {
  valid: boolean;
  reason?: string;
};

export type NormalizedPaymentStatus = 'PAID' | 'PENDING' | 'EXPIRED' | 'FAILED' | 'UNKNOWN';

export type NormalizedWebhookEvent = {
  /** Unique per delivery — used for idempotency (provider event id). */
  eventId: string;
  externalId: string;
  providerRef?: string;
  status: NormalizedPaymentStatus;
  paidAmount?: number;
  raw: unknown;
};

/**
 * Billing talks only to this interface.
 * Implementations: XenditAdapter, StubAdapter, (future MidtransAdapter).
 */
export interface PaymentProvider {
  readonly code: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): WebhookVerification;
  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): NormalizedWebhookEvent;
}
