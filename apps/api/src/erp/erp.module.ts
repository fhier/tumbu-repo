import { Module } from '@nestjs/common';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { ExcelImportService } from './excel-import.service';
import { TenantContext } from './tenant.context';
import { PlanQuotaService } from '../platform/plan-quota.service';

@Module({
  controllers: [ErpController],
  providers: [ErpService, ExcelImportService, TenantContext, PlanQuotaService],
  exports: [ErpService, TenantContext, ExcelImportService, PlanQuotaService],
})
export class ErpModule {}
