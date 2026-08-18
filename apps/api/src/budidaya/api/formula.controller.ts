import { Controller, Get, Param, UseFilters } from '@nestjs/common';
import { CycleFormulaService } from '../formula/services/cycle-formula.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Baca Formula Layer untuk satu siklus.
 * Tidak menerima write KPI. Tidak memicu event.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/cycles/:cycleId/formula')
export class BudidayaFormulaController {
  constructor(private readonly formula: CycleFormulaService) {}

  @Get()
  get(@Param('cycleId') cycleId: string) {
    return this.formula.forCycle(cycleId);
  }
}
