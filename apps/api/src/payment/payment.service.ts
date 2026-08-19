// @ts-nocheck
import {
  BadRequestException, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PlatformService } from '../platform/platform.service';
import { AuditService } from '../auth/audit.service';
import { PAYMENT_PROVIDER } from './payment.tokens';
import type { PaymentProvider } from './payment.types';
import { StubPaymentAdapter } from './adapters/stub.adapter';
import { XenditPaymentAdapter } from './adapters/xendit.adapter';
import { EmailService } from '../email/email.service';
import { workspaceNotifyEmails } from '../email/email.recipients';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly platform: PlatformService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly email: EmailService,
  ) {}

  /** Resolve adapter by code (webhook path) or active default. */
  resolveProvider(code?: string): PaymentProvider {
    const c = (code || this.provider.code || process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();
    if (c === 'stub') return new StubPaymentAdapter();
    if (c === 'xendit') return new XenditPaymentAdapter();
    throw new BadRequestException(`Provider pembayaran tidak dikenal: ${c}`);
  }

  async createCheckout(
    token: string | undefined,
    input: { invoiceId?: string; workspaceId?: string; channel?: string } = {},
  ) {
    if (!input.invoiceId?.trim()) throw new BadRequestException('invoiceId wajib.');
    const session = await this.auth.requireSession(token);
    const inv = await this.prisma.platformInvoice.findUnique({
      where: { id: String(input.invoiceId).trim() },
      include: { tenant: true },
    });
    if (!inv) throw new BadRequestException('Invoice tidak ditemukan.');
    if (input.workspaceId && input.workspaceId !== inv.tenantId) {
      throw new BadRequestException('workspaceId tidak cocok dengan invoice.');
    }
    if (!session.isPlatformAdmin) {
      const mem = await this.prisma.workspaceMember.findUnique({
        where: { userId_tenantId: { userId: session.userId, tenantId: inv.tenantId } },
      });
      if (!mem || !['OWNER', 'ADMIN'].includes(mem.role)) {
        throw new ForbiddenException('Hanya Owner/Admin workspace yang dapat membuat pembayaran.');
      }
    }
    const status = String(inv.status || '').toUpperCase();
    if (status === 'PAID') throw new BadRequestException('Invoice sudah lunas.');
    if (status === 'VOID') throw new BadRequestException('Invoice dibatalkan.');

    const adapter = this.provider;
    const amount = Number(inv.amount);
    const created = await adapter.createPayment({
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      amount,
      currency: 'IDR',
      description: inv.description || `Tagihan ${inv.number} — ${inv.planName}`,
      customerEmail: session.email,
      customerName: session.name,
      channel: input.channel,
      successRedirectUrl: process.env.PAYMENT_SUCCESS_URL || undefined,
      failureRedirectUrl: process.env.PAYMENT_FAILURE_URL || undefined,
    });

    const updated = await this.prisma.platformInvoice.update({
      where: { id: inv.id },
      data: {
        paymentProvider: created.provider,
        paymentExternalId: created.externalId,
        paymentProviderRef: created.providerRef,
        paymentCheckoutUrl: created.checkoutUrl || null,
        paymentChannel: created.channel || null,
      },
    });

    await this.audit.log({
      action: 'payment.checkout',
      userId: session.userId,
      tenantId: inv.tenantId,
      entity: 'PlatformInvoice',
      entityId: inv.id,
      meta: {
        provider: created.provider,
        externalId: created.externalId,
        providerRef: created.providerRef,
      },
    });

    return {
      invoiceId: updated.id,
      number: updated.number,
      amount,
      status: updated.status,
      provider: updated.paymentProvider,
      externalId: updated.paymentExternalId,
      providerRef: updated.paymentProviderRef,
      checkoutUrl: updated.paymentCheckoutUrl,
      channel: updated.paymentChannel,
    };
  }

  /**
   * Public webhook — verify signature, idempotent by (provider, eventId),
   * then PAID → existing Billing restore.
   */
  async handleWebhook(
    providerCode: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ) {
    const code = String(providerCode || '').toLowerCase().trim();
    // Production: stub webhook disabled unless explicitly allowed or PAYMENT_PROVIDER=stub
    if (code === 'stub' && process.env.NODE_ENV === 'production') {
      const active = (process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();
      if (active !== 'stub' && process.env.ALLOW_STUB_WEBHOOK !== '1') {
        throw new UnauthorizedException('Stub webhook dinonaktifkan di production.');
      }
    }

    const adapter = this.resolveProvider(code);
    const verification = adapter.verifyWebhook(headers, rawBody);
    if (!verification.valid) {
      throw new UnauthorizedException(verification.reason || 'Signature webhook tidak valid.');
    }

    let event;
    try {
      event = adapter.parseWebhook(headers, rawBody);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Payload webhook tidak valid.');
    }

    // Idempotency: unique (provider, eventId) — duplicate → no side effects
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: adapter.code,
          eventId: event.eventId,
          status: 'RECEIVED',
          payloadJson: rawBody.slice(0, 50_000),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return {
          ok: true,
          duplicate: true,
          provider: adapter.code,
          eventId: event.eventId,
          message: 'Webhook sudah diproses sebelumnya (idempotent).',
        };
      }
      throw e;
    }

    const inv = await this.prisma.platformInvoice.findFirst({
      where: {
        OR: [
          { paymentExternalId: event.externalId },
          ...(event.providerRef ? [{ paymentProviderRef: event.providerRef }] : []),
        ],
      },
    });

    if (!inv) {
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
        data: { status: 'ORPHAN' },
      });
      throw new BadRequestException('Invoice tidak ditemukan untuk externalId webhook.');
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
      data: { invoiceId: inv.id },
    });

    // Cross-provider guard: stub must not settle xendit (or other) checkouts
    if (inv.paymentProvider && inv.paymentProvider !== adapter.code) {
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
        data: { status: 'PROVIDER_MISMATCH' },
      });
      throw new UnauthorizedException(
        `Webhook ${adapter.code} ditolak: invoice memakai provider ${inv.paymentProvider}.`,
      );
    }

    if (String(inv.status).toUpperCase() === 'PAID') {
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
        data: { status: 'ALREADY_PAID' },
      });
      return {
        ok: true,
        duplicate: false,
        alreadyPaid: true,
        invoiceId: inv.id,
        provider: adapter.code,
        eventId: event.eventId,
      };
    }

    if (event.status !== 'PAID') {
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
        data: { status: `IGNORED_${event.status}` },
      });
      const failed = /FAIL|EXPIRED|CANCEL|VOID/i.test(String(event.status || ''));
      if (failed) {
        void workspaceNotifyEmails(this.prisma, inv.tenantId).then(async (recipients) => {
          for (const r of recipients) {
            await this.email.sendSafe({
              kind: 'PAYMENT_FAILED',
              to: r.email,
              name: r.name,
              invoiceNumber: inv.number,
              amount: Number(inv.amount),
              workspaceName: undefined,
            });
          }
        }).catch(() => undefined);
      }
      return {
        ok: true,
        ignored: true,
        status: event.status,
        invoiceId: inv.id,
        provider: adapter.code,
        eventId: event.eventId,
      };
    }

    if (event.paidAmount !== undefined && Number.isFinite(event.paidAmount)) {
      const due = Number(inv.amount);
      if (event.paidAmount + 0.0001 < due) {
        await this.prisma.paymentWebhookEvent.update({
          where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
          data: { status: 'AMOUNT_MISMATCH' },
        });
        throw new BadRequestException(
          `Nominal webhook (${event.paidAmount}) lebih kecil dari tagihan (${due}).`,
        );
      }
    }

    // Single PAID path — existing Billing restore (commercialStatus SUBSCRIBED, etc.)
    await this.platform.updateBillingInvoice({
      id: inv.id,
      status: 'PAID',
      notes: `Paid via ${adapter.code} (${event.eventId})`,
    });

    if (event.providerRef && !inv.paymentProviderRef) {
      await this.prisma.platformInvoice.update({
        where: { id: inv.id },
        data: { paymentProviderRef: event.providerRef, paymentProvider: adapter.code },
      });
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: adapter.code, eventId: event.eventId } },
      data: { status: 'PROCESSED' },
    });

    const tenant = await this.prisma.workspace.findUnique({
      where: { id: inv.tenantId },
      select: { name: true },
    });
    await this.audit.log({
      action: 'payment.webhook.paid',
      tenantId: inv.tenantId,
      entity: 'PlatformInvoice',
      entityId: inv.id,
      meta: {
        provider: adapter.code,
        eventId: event.eventId,
        externalId: event.externalId,
        workspaceName: tenant?.name || null,
      },
    });

    void workspaceNotifyEmails(this.prisma, inv.tenantId).then(async (recipients) => {
      for (const r of recipients) {
        await this.email.sendSafe({
          kind: 'PAYMENT_SUCCESS',
          to: r.email,
          name: r.name,
          invoiceNumber: inv.number,
          amount: Number(inv.amount),
          workspaceName: tenant?.name || undefined,
        });
      }
    }).catch(() => undefined);

    return {
      ok: true,
      paid: true,
      invoiceId: inv.id,
      provider: adapter.code,
      eventId: event.eventId,
    };
  }
}

