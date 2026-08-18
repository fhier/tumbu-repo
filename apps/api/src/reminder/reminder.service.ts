import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { workspaceNotifyEmails } from '../email/email.recipients';
import type { ReminderEvent, ReminderKind } from './reminder.types';
import { normalizeInvoiceStatus } from '../platform/workspace-status';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Scan open invoices / grace / trial windows and dispatch email reminders (idempotent).
   * Manual: POST /platform/billing/remind
   */
  async run(input: { workspaceId?: string } = {}) {
    const profile = await this.prisma.platformBillingProfile.findUnique({ where: { id: 'default' } });
    const remindBeforeDays = profile?.remindBeforeDays ?? 3;
    const now = new Date();
    const beforeDueCutoff = new Date(now);
    beforeDueCutoff.setDate(beforeDueCutoff.getDate() + remindBeforeDays);

    const tenantFilter = input.workspaceId?.trim()
      ? { id: String(input.workspaceId).trim() }
      : { code: { not: '_tumbu_accounts' } };

    const sent: Array<{ kind: ReminderKind; dedupeKey: string }> = [];
    const skipped: Array<{ kind: ReminderKind; dedupeKey: string; reason: string }> = [];

    const track = (
      kind: ReminderKind,
      dedupeKey: string,
      result: { duplicate: boolean },
    ) => {
      if (result.duplicate) skipped.push({ kind, dedupeKey, reason: 'duplicate' });
      else sent.push({ kind, dedupeKey });
    };

    const invoices = await this.prisma.platformInvoice.findMany({
      where: {
        status: { in: ['UNPAID', 'ISSUED', 'OVERDUE'] },
        ...(input.workspaceId?.trim() ? { tenantId: String(input.workspaceId).trim() } : {}),
      },
      include: { tenant: { select: { id: true, code: true, name: true, status: true, graceUntil: true } } },
      take: 2000,
    });

    for (const inv of invoices) {
      if (!inv.tenant || inv.tenant.code === '_tumbu_accounts') continue;
      const norm = normalizeInvoiceStatus(inv.status, inv.dueAt, now);

      if (norm === 'UNPAID' && inv.dueAt && inv.dueAt > now && inv.dueAt <= beforeDueCutoff) {
        track('BEFORE_DUE', inv.id, await this.dispatch({
          kind: 'BEFORE_DUE',
          tenantId: inv.tenantId,
          tenantCode: inv.tenant.code,
          tenantName: inv.tenant.name,
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          amount: Number(inv.amount),
          dueAt: inv.dueAt.toISOString(),
          dedupeKey: inv.id,
        }));
      }

      if (norm === 'OVERDUE') {
        track('ON_OVERDUE', inv.id, await this.dispatch({
          kind: 'ON_OVERDUE',
          tenantId: inv.tenantId,
          tenantCode: inv.tenant.code,
          tenantName: inv.tenant.name,
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          amount: Number(inv.amount),
          dueAt: inv.dueAt?.toISOString() || null,
          dedupeKey: inv.id,
        }));
      }
    }

    const tenants = await this.prisma.tenant.findMany({
      where: { ...tenantFilter, status: { in: ['GRACE', 'SUSPENDED'] } },
    });

    for (const t of tenants) {
      if (t.status === 'GRACE') {
        const key = `${t.id}:grace`;
        track('ON_GRACE', key, await this.dispatch({
          kind: 'ON_GRACE',
          tenantId: t.id,
          tenantCode: t.code,
          tenantName: t.name,
          graceUntil: t.graceUntil?.toISOString() || null,
          dedupeKey: key,
        }));
      }
      if (t.status === 'SUSPENDED') {
        const key = `${t.id}:suspend`;
        track('ON_SUSPEND', key, await this.dispatch({
          kind: 'ON_SUSPEND',
          tenantId: t.id,
          tenantCode: t.code,
          tenantName: t.name,
          graceUntil: t.graceUntil?.toISOString() || null,
          dedupeKey: key,
        }));
      }
    }

    // Trial ending soon
    const trialCutoff = new Date(now);
    trialCutoff.setDate(trialCutoff.getDate() + remindBeforeDays);
    const trialTenants = await this.prisma.tenant.findMany({
      where: {
        ...tenantFilter,
        commercialStatus: 'TRIAL',
        trialEndsAt: { gt: now, lte: trialCutoff },
      },
      take: 500,
    });
    for (const t of trialTenants) {
      const key = `${t.id}:trial:${t.trialEndsAt?.toISOString().slice(0, 10) || 'x'}`;
      track('TRIAL_REMINDER', key, await this.dispatch({
        kind: 'TRIAL_REMINDER',
        tenantId: t.id,
        tenantCode: t.code,
        tenantName: t.name,
        trialEndsAt: t.trialEndsAt?.toISOString() || null,
        dedupeKey: key,
      }));
    }

    return {
      channel: this.email.channel,
      remindBeforeDays,
      sent: sent.length,
      skipped: skipped.length,
      sentItems: sent,
      skippedItems: skipped,
    };
  }

  async notifyTransition(input: {
    kind: ReminderKind;
    tenantId: string;
    invoiceId?: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant || tenant.code === '_tumbu_accounts') return { duplicate: true as const };

    const event: ReminderEvent = {
      kind: input.kind,
      tenantId: tenant.id,
      tenantCode: tenant.code,
      tenantName: tenant.name,
      graceUntil: tenant.graceUntil?.toISOString() || null,
      trialEndsAt: tenant.trialEndsAt?.toISOString() || null,
      dedupeKey: `${tenant.id}:${input.kind.toLowerCase()}`,
    };

    if (input.invoiceId) {
      const inv = await this.prisma.platformInvoice.findUnique({ where: { id: input.invoiceId } });
      if (inv) {
        event.invoiceId = inv.id;
        event.invoiceNumber = inv.number;
        event.amount = Number(inv.amount);
        event.dueAt = inv.dueAt?.toISOString() || null;
        event.dedupeKey = inv.id;
      }
    }

    return this.dispatch(event);
  }

  /** Notify subscription/trial expired (idempotent per day). */
  async notifySubscriptionExpired(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.code === '_tumbu_accounts') return;
    const day = new Date().toISOString().slice(0, 10);
    await this.dispatch({
      kind: 'SUBSCRIPTION_EXPIRED',
      tenantId: tenant.id,
      tenantCode: tenant.code,
      tenantName: tenant.name,
      trialEndsAt: tenant.trialEndsAt?.toISOString() || null,
      dedupeKey: `${tenant.id}:expired:${day}`,
    });
  }

  private async dispatch(event: ReminderEvent) {
    try {
      await this.prisma.reminderDispatch.create({
        data: {
          kind: event.kind,
          dedupeKey: event.dedupeKey,
          tenantId: event.tenantId,
          invoiceId: event.invoiceId || null,
          channel: this.email.channel,
          payloadJson: JSON.stringify(event),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { duplicate: true as const, kind: event.kind, dedupeKey: event.dedupeKey };
      }
      throw e;
    }

    const recipients = await workspaceNotifyEmails(this.prisma, event.tenantId);
    let accepted = false;
    for (const r of recipients) {
      const kind =
        event.kind === 'BEFORE_DUE' || event.kind === 'ON_OVERDUE'
          ? 'INVOICE_CREATED'
          : event.kind === 'TRIAL_REMINDER'
            ? 'TRIAL_REMINDER'
            : 'SUBSCRIPTION_EXPIRED';

      const result = await this.email.sendSafe({
        kind,
        to: r.email,
        name: r.name,
        workspaceName: event.tenantName,
        invoiceNumber: event.invoiceNumber,
        amount: event.amount,
        dueAt: event.dueAt,
        trialEndsAt: event.trialEndsAt || event.graceUntil,
      });
      if (result.accepted) accepted = true;
    }

    this.logger.log(
      `reminder kind=${event.kind} tenant=${event.tenantId} accepted=${accepted} recipients=${recipients.length}`,
    );
    return { duplicate: false as const, kind: event.kind, dedupeKey: event.dedupeKey, result: { accepted } };
  }
}
