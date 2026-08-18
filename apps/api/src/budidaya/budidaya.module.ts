import { Module } from '@nestjs/common';
import { ErpModule } from '../erp/erp.module';
import { BudidayaMasterService } from './application/master.service';
import { BudidayaSettingsService } from './application/settings.service';
import { BudidayaCycleService } from './application/cycle.service';
import { BudidayaEventService } from './application/event.service';
import { CycleFormulaService } from './formula/services/cycle-formula.service';
import { AquaDashboardService } from './dashboard/services/aqua-dashboard.service';
import { AquaAnalysisService } from './analysis/services/aqua-analysis.service';
import { BudidayaMasterController } from './api/master.controller';
import { BudidayaSettingsController } from './api/settings.controller';
import { BudidayaCycleController } from './api/cycle.controller';
import {
  BudidayaEventController,
  BudidayaEventVoidController,
} from './api/event.controller';
import { BudidayaFormulaController } from './api/formula.controller';
import { BudidayaDashboardController } from './api/dashboard.controller';
import {
  BudidayaAnalysisController,
  BudidayaCycleAnalysisController,
} from './api/analysis.controller';
import { CycleTransitionService } from './workflow/cycle-transition.service';

/**
 * 8.1–8.7: Foundation → Master → Cycle → Events → Formula → Dashboard → Analisa
 * Berikutnya 8.8: hardening V1 · regresi · docs · siap available:true (Owner)
 */
@Module({
  imports: [ErpModule],
  controllers: [
    BudidayaMasterController,
    BudidayaSettingsController,
    BudidayaCycleController,
    BudidayaEventController,
    BudidayaEventVoidController,
    BudidayaFormulaController,
    BudidayaDashboardController,
    BudidayaAnalysisController,
    BudidayaCycleAnalysisController,
  ],
  providers: [
    BudidayaMasterService,
    BudidayaSettingsService,
    BudidayaCycleService,
    BudidayaEventService,
    CycleFormulaService,
    AquaDashboardService,
    AquaAnalysisService,
    CycleTransitionService,
  ],
  exports: [
    BudidayaMasterService,
    BudidayaSettingsService,
    BudidayaCycleService,
    BudidayaEventService,
    CycleFormulaService,
    AquaDashboardService,
    AquaAnalysisService,
    CycleTransitionService,
  ],
})
export class BudidayaModule {}
