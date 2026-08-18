/** Reminder — billing/trial notification kinds (sent via EmailService). */

export type ReminderKind =
  | 'BEFORE_DUE'
  | 'ON_OVERDUE'
  | 'ON_GRACE'
  | 'ON_SUSPEND'
  | 'TRIAL_REMINDER'
  | 'SUBSCRIPTION_EXPIRED';

export type ReminderEvent = {
  kind: ReminderKind;
  tenantId: string;
  tenantCode?: string;
  tenantName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  dueAt?: string | null;
  graceUntil?: string | null;
  trialEndsAt?: string | null;
  /** Stable key for idempotency (unique with kind). */
  dedupeKey: string;
};
