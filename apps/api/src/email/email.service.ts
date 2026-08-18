import { Injectable, Logger } from '@nestjs/common';

let Resend: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Resend = require('resend');
} catch (e) {
  // Resend not installed – will be handled gracefully at runtime.
  Resend = null;
}

import { renderEmail } from './email.templates';
import type { EmailSendInput, EmailSendResult } from './email.types';
import { appOrigin, maskEmail } from './email.types';

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readConfig(): { apiKey: string; from: string; replyTo: string } | null {
  const provider = (process.env.EMAIL_PROVIDER || process.env.DELIVERY_PROVIDER || '').toLowerCase().trim();
  if (provider && provider !== 'resend') {
    return null;
  }
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) return null;
  const replyTo = (process.env.EMAIL_REPLY_TO || 'halo@tumbu.web.id').trim();
  return { apiKey, from, replyTo };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  readonly channel = 'resend' as const;

  /** Soft config check — never throws. */
  isConfigured(): boolean {
    return readConfig() != null && (process.env.EMAIL_PROVIDER || 'resend').toLowerCase().trim() === 'resend';
  }

  status() {
    const cfg = readConfig();
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim() || 'unset';
    return {
      provider,
      channel: this.channel,
      configured: !!cfg && provider === 'resend',
      fromSet: !!(process.env.EMAIL_FROM || '').trim(),
      apiKeySet: !!(process.env.RESEND_API_KEY || '').trim(),
      replyToSet: !!(process.env.EMAIL_REPLY_TO || '').trim(),
      appUrl: appOrigin(),
    };
  }

  /** Send transactional email via Resend. Never throws to callers — failures return accepted:false. */
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      this.logger.warn(`email skip invalid to kind=${input.kind}`);
      return { channel: this.channel, accepted: false, message: 'invalid recipient' };
    }

    const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase().trim();
    if (provider !== 'resend') {
      this.logger.error(`EMAIL_PROVIDER=${provider} — only resend is supported`);
      return { channel: this.channel, accepted: false, message: `unsupported provider: ${provider}` };
    }

    const cfg = readConfig();
    if (!cfg) {
      this.logger.error('Resend not configured (RESEND_API_KEY / EMAIL_FROM)');
      return { channel: this.channel, accepted: false, message: 'resend not configured' };
    }

    const rendered = renderEmail(input);
    const client = Resend ? new Resend(cfg.apiKey) : null;
    let lastErr = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (!client) {
          lastErr = 'Resend library not available';
          break;
        }
        const { data, error } = await client.emails.send({
          from: cfg.from,
          to: [to],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          replyTo: cfg.replyTo,
          headers: {
            'X-Entity-Ref-ID': `${input.kind}-${Date.now()}`,
          },
        });
        if (error) {
          lastErr = error.message || String(error);
          const retryable = /rate|timeout|5\d\d|temporar|unavailable/i.test(lastErr);
          this.logger.warn(`resend fail kind=${input.kind} to=${maskEmail(to)} attempt=${attempt}/${MAX_ATTEMPTS} err=${lastErr}`);
          if (retryable && attempt < MAX_ATTEMPTS) {
            await sleep(250 * 2 ** (attempt - 1));
            continue;
          }
          return { channel: this.channel, accepted: false, message: lastErr };
        }
        const id = data?.id;
        this.logger.log(`resend ok kind=${input.kind} to=${maskEmail(to)} id=${id || 'n/a'}`);
        return { channel: this.channel, accepted: true, message: `resend:${input.kind}:${maskEmail(to)}`, providerId: id };
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        this.logger.warn(`resend exception kind=${input.kind} to=${maskEmail(to)} attempt=${attempt}/${MAX_ATTEMPTS} err=${lastErr}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
      }
    }
    return { channel: this.channel, accepted: false, message: lastErr || 'send failed' };
  }

  /** Fire-and-forget helper for business hooks. */
  async sendSafe(input: EmailSendInput): Promise<EmailSendResult> {
    try {
      return await this.send(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`email sendSafe crashed kind=${input.kind}: ${msg}`);
      return { channel: this.channel, accepted: false, message: msg };
    }
  }
}
