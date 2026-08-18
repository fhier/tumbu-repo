import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { ApiWallGuard } from './api-wall.guard';
import { AuditService } from './audit.service';
import { TenantInterceptor } from './tenant.interceptor';
import { ErpModule } from '../erp/erp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { ReminderModule } from '../reminder/reminder.module';
import { LeadsController } from './leads.controller';

@Module({
  imports: [ErpModule, PrismaModule, EmailModule, ReminderModule],
  controllers: [AuthController, LeadsController],
  providers: [
    AuthService,
    AuditService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ApiWallGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [AuthService, AuditService],
})
export class AuthModule {}
