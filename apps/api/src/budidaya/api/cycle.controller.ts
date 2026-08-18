import { Body, Controller, Get, Param, Patch, Post, Query, UseFilters } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { BudidayaCycleService } from '../application/cycle.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * CultureCycle — 8.3
 * Tidak ada endpoint event produksi / formula / dashboard.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/cycles')
export class BudidayaCycleController {
  constructor(private readonly cycles: BudidayaCycleService) {}

  @Get()
  list(@Query('state') state?: string, @Query('pondId') pondId?: string) {
    return this.cycles.list({ state, pondId });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cycles.get(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post()
  create(@Body() body: object) {
    return this.cycles.create(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  updatePlan(@Param('id') id: string, @Body() body: object) {
    return this.cycles.updatePlan(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/ready')
  markReady(@Param('id') id: string) {
    return this.cycles.markReady(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.cycles.cancel(id);
  }
}
