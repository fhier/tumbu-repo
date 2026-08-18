import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ErpModule } from './erp/erp.module';
import { PlatformModule } from './platform/platform.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServiceModule } from './service/service.module';
import { PaymentModule } from './payment/payment.module';
import { BudidayaModule } from './budidaya/budidaya.module';
import { EmailModule } from './email/email.module';
import { SyncModule } from './modules/sync/sync.module';
import { ReceiptModule } from './modules/receipt/receipt.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    EmailModule,
    ErpModule,
    PlatformModule,
    AuthModule,
    ServiceModule,
    PaymentModule,
    BudidayaModule,
    SyncModule,
    ReceiptModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
