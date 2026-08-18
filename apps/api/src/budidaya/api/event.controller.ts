import { Body, Controller, Get, Param, Post, UseFilters } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { BudidayaEventService } from '../application/event.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Event API — append-only create (+ void).
 * Trace: Docs 56·62 · Module budidaya · Journey J1–J5
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/cycles/:cycleId/events')
export class BudidayaEventController {
  constructor(private readonly events: BudidayaEventService) {}

  @Get()
  list(@Param('cycleId') cycleId: string) {
    return this.events.listByCycle(cycleId);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('stocking')
  stocking(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createStocking(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('feed')
  feed(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createFeed(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('mortality')
  mortality(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createMortality(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('sampling')
  sampling(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createSampling(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('medicine')
  medicine(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createMedicine(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('expense')
  expense(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createExpense(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('harvest')
  harvest(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createHarvest(cycleId, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('close')
  close(@Param('cycleId') cycleId: string, @Body() body: object) {
    return this.events.createClose(cycleId, body as Record<string, unknown>);
  }
}

@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/events')
export class BudidayaEventVoidController {
  constructor(private readonly events: BudidayaEventService) {}

  @Roles('OWNER', 'ADMIN')
  @Post('feed/:id/void')
  voidFeed(@Param('id') id: string, @Body() body: object) {
    return this.events.voidFeed(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('mortality/:id/void')
  voidMortality(@Param('id') id: string, @Body() body: object) {
    return this.events.voidMortality(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('sampling/:id/void')
  voidSampling(@Param('id') id: string, @Body() body: object) {
    return this.events.voidSampling(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('medicine/:id/void')
  voidMedicine(@Param('id') id: string, @Body() body: object) {
    return this.events.voidMedicine(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('expense/:id/void')
  voidExpense(@Param('id') id: string, @Body() body: object) {
    return this.events.voidExpense(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('harvest/:id/void')
  voidHarvest(@Param('id') id: string, @Body() body: object) {
    return this.events.voidHarvest(id, (body as { reason?: string })?.reason);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('stocking/:id/void')
  voidStocking(@Param('id') id: string, @Body() body: object) {
    return this.events.voidStocking(id, (body as { reason?: string })?.reason);
  }
}
