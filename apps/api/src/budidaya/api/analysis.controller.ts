import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { AquaAnalysisService } from '../analysis/services/aqua-analysis.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Analisa = View eksploratif. Baca Formula saja.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/analysis')
export class BudidayaAnalysisController {
  constructor(private readonly analysis: AquaAnalysisService) {}

  @Get()
  hub(@Query('cycleId') cycleId?: string) {
    return this.analysis.compose(cycleId);
  }
}

@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/cycles/:cycleId/analysis')
export class BudidayaCycleAnalysisController {
  constructor(private readonly analysis: AquaAnalysisService) {}

  @Get()
  forCycle(@Param('cycleId') cycleId: string) {
    return this.analysis.forCycle(cycleId);
  }
}
