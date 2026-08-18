import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { BudidayaMasterService } from '../application/master.service';
import { BudidayaUserFacingFilter } from '../common/budidaya-user-facing.filter';

/**
 * Master Data Budidaya — 8.2
 * CRUD referensi saja. Tidak ada Formula / Workflow / Dashboard.
 */
@UseFilters(BudidayaUserFacingFilter)
@Controller('budidaya/master')
export class BudidayaMasterController {
  constructor(private readonly master: BudidayaMasterService) {}

  // Pond
  @Get('ponds')
  listPonds(@Query('includeRetired') includeRetired?: string) {
    return this.master.listPonds(includeRetired === '1' || includeRetired === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('ponds')
  createPond(@Body() body: object) {
    return this.master.createPond(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('ponds/:id')
  updatePond(@Param('id') id: string, @Body() body: object) {
    return this.master.updatePond(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('ponds/:id/deactivate')
  deactivatePond(@Param('id') id: string) {
    return this.master.deactivatePond(id);
  }

  // Species
  @Get('catalog/pond-systems')
  catalogPondSystems() {
    return this.master.catalogPondSystems();
  }

  @Get('catalog/vessel-groups')
  catalogVesselGroups() {
    return this.master.catalogVesselGroups();
  }

  @Get('catalog/species')
  catalogSpecies() {
    return this.master.catalogSpecies();
  }

  @Get('species')
  listSpecies(@Query('includeInactive') includeInactive?: string) {
    return this.master.listSpecies(includeInactive === '1' || includeInactive === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('species')
  createSpecies(@Body() body: object) {
    return this.master.createSpecies(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('species/:id')
  updateSpecies(@Param('id') id: string, @Body() body: object) {
    return this.master.updateSpecies(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('species/:id/deactivate')
  deactivateSpecies(@Param('id') id: string) {
    return this.master.deactivateSpecies(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('species/ensure-defaults')
  ensureDefaultSpecies() {
    return this.master.ensureDefaultSpecies();
  }

  // Feed types
  @Get('feed-types')
  listFeedTypes(@Query('includeInactive') includeInactive?: string) {
    return this.master.listFeedTypes(includeInactive === '1' || includeInactive === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('feed-types')
  createFeedType(@Body() body: object) {
    return this.master.createFeedType(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('feed-types/:id')
  updateFeedType(@Param('id') id: string, @Body() body: object) {
    return this.master.updateFeedType(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('feed-types/:id/deactivate')
  deactivateFeedType(@Param('id') id: string) {
    return this.master.deactivateFeedType(id);
  }

  // Cost categories
  @Get('cost-categories')
  listCostCategories(@Query('includeInactive') includeInactive?: string) {
    return this.master.listCostCategories(includeInactive === '1' || includeInactive === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('cost-categories')
  createCostCategory(@Body() body: object) {
    return this.master.createCostCategory(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('cost-categories/:id')
  updateCostCategory(@Param('id') id: string, @Body() body: object) {
    return this.master.updateCostCategory(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('cost-categories/:id/deactivate')
  deactivateCostCategory(@Param('id') id: string) {
    return this.master.deactivateCostCategory(id);
  }

  // Indicator rules
  @Get('indicator-rules')
  listIndicatorRules(@Query('includeInactive') includeInactive?: string) {
    return this.master.listIndicatorRules(includeInactive === '1' || includeInactive === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('indicator-rules')
  createIndicatorRule(@Body() body: object) {
    return this.master.createIndicatorRule(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('indicator-rules/:id')
  updateIndicatorRule(@Param('id') id: string, @Body() body: object) {
    return this.master.updateIndicatorRule(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('indicator-rules/:id/deactivate')
  deactivateIndicatorRule(@Param('id') id: string) {
    return this.master.deactivateIndicatorRule(id);
  }

  // Strain
  @Get('strains')
  listStrains(
    @Query('includeInactive') includeInactive?: string,
    @Query('speciesProfileId') speciesProfileId?: string,
  ) {
    return this.master.listStrains(
      includeInactive === '1' || includeInactive === 'true',
      speciesProfileId,
    );
  }

  @Roles('OWNER', 'ADMIN')
  @Post('strains')
  createStrain(@Body() body: object) {
    return this.master.createStrain(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('strains/:id')
  updateStrain(@Param('id') id: string, @Body() body: object) {
    return this.master.updateStrain(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('strains/:id/deactivate')
  deactivateStrain(@Param('id') id: string) {
    return this.master.deactivateStrain(id);
  }

  // Units
  @Get('units')
  listUnits(@Query('includeInactive') includeInactive?: string) {
    return this.master.listUnits(includeInactive === '1' || includeInactive === 'true');
  }

  @Roles('OWNER', 'ADMIN')
  @Post('units')
  createUnit(@Body() body: object) {
    return this.master.createUnit(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: object) {
    return this.master.updateUnit(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('units/:id/deactivate')
  deactivateUnit(@Param('id') id: string) {
    return this.master.deactivateUnit(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('units/ensure-defaults')
  ensureDefaultUnits() {
    return this.master.ensureDefaultUnits();
  }

  // Mortality causes
  @Get('mortality-causes')
  listMortalityCauses(@Query('includeInactive') includeInactive?: string) {
    return this.master.listMortalityCauses(
      includeInactive === '1' || includeInactive === 'true',
    );
  }

  @Roles('OWNER', 'ADMIN')
  @Post('mortality-causes')
  createMortalityCause(@Body() body: object) {
    return this.master.createMortalityCause(body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('mortality-causes/:id')
  updateMortalityCause(@Param('id') id: string, @Body() body: object) {
    return this.master.updateMortalityCause(id, body as Record<string, unknown>);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('mortality-causes/:id/deactivate')
  deactivateMortalityCause(@Param('id') id: string) {
    return this.master.deactivateMortalityCause(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('mortality-causes/ensure-defaults')
  ensureDefaultMortalityCauses() {
    return this.master.ensureDefaultMortalityCauses();
  }
}
