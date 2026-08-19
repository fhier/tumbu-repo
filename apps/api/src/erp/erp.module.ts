import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { ExcelImportService } from './excel-import.service';
import { TenantContext } from './tenant.context';
import { PlanQuotaService } from '../platform/plan-quota.service';
import { HarvestClosedListener } from './harvest-closed.listener';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [ErpController],
  providers: [ErpService, ExcelImportService, TenantContext, PlanQuotaService, HarvestClosedListener],
  exports: [ErpService, TenantContext, ExcelImportService, PlanQuotaService],
})
export class ErpModule {}
