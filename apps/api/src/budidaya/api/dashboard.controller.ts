import { Controller, Get, UseFilters } from '@nestjs/common';
import { AquaDashboardService } from '../dashboard/services/aqua-dashboard.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Dashboard View — baca Formula via widget composition.
 * Tidak ada write / rumus / business rule warna.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/dashboard')
export class BudidayaDashboardController {
  constructor(private readonly dashboard: AquaDashboardService) {}

  @Get()
  get() {
    return this.dashboard.compose();
  }
}
