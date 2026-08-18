import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PAYMENT_PROVIDER } from './payment.tokens';
import { StubPaymentAdapter } from './adapters/stub.adapter';
import { XenditPaymentAdapter } from './adapters/xendit.adapter';
import type { PaymentProvider } from './payment.types';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

function buildActiveProvider(): PaymentProvider {
  const code = (process.env.PAYMENT_PROVIDER || 'stub').toLowerCase().trim();
  if (code === 'xendit') return new XenditPaymentAdapter();
  return new StubPaymentAdapter();
}

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), forwardRef(() => PlatformModule), EmailModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    { provide: PAYMENT_PROVIDER, useFactory: buildActiveProvider },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
