import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  /** Authenticated: create provider payment for an unpaid invoice. */
  @Post('checkout')
  checkout(
    @Body() body: { invoiceId?: string; workspaceId?: string; channel?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.payment.createCheckout(token, body);
  }

  /**
   * Public webhook — AuthGuard allowlisted.
   * Provider path: stub | xendit
   */
  @Post('webhooks/:provider')
  webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: { rawBody?: Buffer; body?: unknown },
  ) {
    const raw =
      req.rawBody?.toString('utf8')
      || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return this.payment.handleWebhook(provider, headers, raw);
  }
}
