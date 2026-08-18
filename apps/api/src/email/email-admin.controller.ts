import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { EmailService } from './email.service';

/**
 * Platform Founder tools — status + one-shot smoke send.
 * Does not expose API keys.
 */
@Controller('platform/email')
export class EmailAdminController {
  constructor(private readonly email: EmailService) {}

  @Get('status')
  @Roles('PLATFORM_ADMIN')
  status() {
    return this.email.status();
  }

  @Post('smoke')
  @Roles('PLATFORM_ADMIN')
  async smoke(@Body() body: { to?: string } = {}) {
    const to = String(body.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return { ok: false, message: 'Field to (email) wajib.' };
    }
    const status = this.email.status();
    const result = await this.email.send({
      kind: 'WELCOME',
      to,
      name: 'Smoke Test',
    });
    return {
      ok: result.accepted,
      status,
      result: {
        channel: result.channel,
        accepted: result.accepted,
        message: result.message,
        providerId: result.providerId,
      },
    };
  }
}
