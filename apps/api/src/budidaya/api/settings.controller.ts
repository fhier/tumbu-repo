import { Body, Controller, Get, Patch, UseFilters } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { BudidayaSettingsService } from '../application/settings.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Settings workspace Budidaya — namespace settingsJson.budidaya.
 * Bukan Formula Engine · bukan Dashboard write.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/settings')
export class BudidayaSettingsController {
  constructor(private readonly settings: BudidayaSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Roles('OWNER', 'ADMIN')
  @Patch()
  update(@Body() body: object) {
    return this.settings.update(body as Record<string, unknown>);
  }
}
