import { Body, Controller, Get, Headers, Patch, Post, Query } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { Roles } from '../auth/roles.decorator';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Roles('PLATFORM_ADMIN')
  @Get('overview') overview() { return this.platform.overview(); }

  @Roles('PLATFORM_ADMIN')
  @Get('manifest') manifest() { return this.platform.manifest(); }

  @Roles('PLATFORM_ADMIN')
  @Get('modules') modules(@Query('workspaceId') workspaceId?: string) {
    return this.platform.modules(workspaceId);
  }

  @Roles('PLATFORM_ADMIN')
  @Patch('modules') setModule(@Body() body: object) { return this.platform.setModule(body); }

  @Roles('PLATFORM_ADMIN')
  @Get('plans') listPlans() { return this.platform.listPlans(); }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/plan') assignWorkspacePlan(@Body() body: object) {
    return this.platform.assignWorkspacePlan(body as { workspaceId?: string; planId?: string });
  }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/demo-mode') setDemoMode(@Body() body: object) {
    return this.platform.setDemoMode(body as { workspaceId?: string; enabled?: boolean });
  }

  @Roles('PLATFORM_ADMIN')
  @Get('workspaces') workspaces() { return this.platform.workspaces(); }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces') createWorkspace(@Body() body: object) { return this.platform.createWorkspace(body); }

  @Post('my/workspaces') createMyWorkspace(@Body() body: object, @Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.createMyWorkspace(body, token);
  }

  /** Portal Owner — daftar usaha + status (ACTIVE/GRACE/SUSPENDED/PENDING). */
  @Get('owner/workspaces') ownerWorkspaces(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.ownerWorkspaces(token);
  }

  @Get('owner/invoices') ownerInvoices(
    @Query('workspaceId') workspaceId?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.ownerInvoices(token, workspaceId);
  }

  @Post('owner/invoices/proof') ownerUploadProof(
    @Body() body: object,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.ownerUploadProof(token, body as {
      workspaceId?: string; invoiceId?: string; fileBase64?: string;
      fileName?: string; mime?: string; note?: string;
    });
  }

  @Get('catalog/blueprints') catalogBlueprints() { return this.platform.catalogBlueprints(); }

  @Get('catalog/plans') catalogPlans() { return this.platform.catalogPlans(); }

  @Roles('PLATFORM_ADMIN')
  @Patch('workspaces') updateWorkspace(@Body() body: object) { return this.platform.updateWorkspace(body); }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/approve') approveWorkspace(
    @Body() body: object,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.approveWorkspace(body as { workspaceId?: string }, token);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/reject') rejectWorkspace(
    @Body() body: object,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.rejectWorkspace(body as { workspaceId?: string }, token);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/batch-approve') batchApproveWorkspaces(
    @Body() body: object,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.batchApproveWorkspaces(body as { workspaceIds?: string[] }, token);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('workspaces/batch-suspend') batchSuspendWorkspaces(
    @Body() body: object,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.batchSuspendWorkspaces(body as { workspaceIds?: string[] }, token);
  }

  @Post('workspaces/activate') activateWorkspace(@Body() body: object, @Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.activateWorkspace(body, token);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('control-plane/enter') enterControlPlane(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.platform.enterControlPlane(token);
  }

  @Get('workspace/context') workspaceContext() { return this.platform.openContext(); }

  @Roles('OWNER', 'ADMIN')
  @Patch('workspace/filter-context') updateFilterContext(@Body() body: object) {
    return this.platform.updateFilterContext(body as {
      allowedSpecies?: string[]; primarySpecies?: string; merge?: boolean;
    });
  }

  /** UX Onboarding Framework — progress + Workspace Ready (bukan domain business logic). */
  @Get('onboarding') getOnboarding() { return this.platform.getOnboarding(); }

  @Roles('OWNER', 'ADMIN')
  @Patch('onboarding') updateOnboarding(@Body() body: object) {
    return this.platform.updateOnboarding(body as {
      currentStepId?: string | null;
      skippedStepIds?: string[];
      markCompleted?: boolean;
    });
  }

  @Get('blueprints') blueprints(@Query('workspaceId') workspaceId?: string) {
    return this.platform.blueprints(workspaceId);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('blueprints/activate') activateBlueprint(@Body() body: object) { return this.platform.activateBlueprint(body); }

  @Roles('PLATFORM_ADMIN')
  @Get('settings') settings(@Query('workspaceId') workspaceId?: string) {
    return this.platform.settings(workspaceId);
  }

  @Roles('PLATFORM_ADMIN')
  @Patch('settings') updateSettings(@Body() body: object) { return this.platform.updateSettings(body); }

  @Roles('PLATFORM_ADMIN')
  @Get('members') members() { return this.platform.listMembers(); }

  @Roles('PLATFORM_ADMIN')
  @Post('members') createMember(@Body() body: object) { return this.platform.createMember(body); }

  @Roles('PLATFORM_ADMIN')
  @Patch('members') updateMember(@Body() body: object) { return this.platform.updateMember(body); }

  @Roles('PLATFORM_ADMIN')
  @Get('leads') leads() { return this.platform.listLeads(); }

  @Roles('PLATFORM_ADMIN')
  @Patch('leads') updateLead(@Body() body: object) { return this.platform.updateLead(body); }

  @Roles('PLATFORM_ADMIN')
  @Post('leads/convert') convertLead(@Body() body: object) {
    return this.platform.convertLead(body as {
      leadId?: string; blueprintId?: string; planId?: string; code?: string;
    });
  }

  @Roles('PLATFORM_ADMIN')
  @Get('audit') audit(@Query('limit') limit?: string) {
    return this.platform.listAudit(limit ? Number(limit) : 100);
  }

  @Roles('PLATFORM_ADMIN')
  @Get('billing/profile') billingProfile() { return this.platform.billingProfile(); }

  @Roles('PLATFORM_ADMIN')
  @Patch('billing/profile') updateBillingProfile(@Body() body: Record<string, unknown>) {
    return this.platform.updateBillingProfile(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Get('billing/invoices') billingInvoices() { return this.platform.listBillingInvoices(); }

  @Roles('PLATFORM_ADMIN')
  @Post('billing/invoices/generate') generateBillingInvoices(@Body() body: { periodYm?: string; tenantId?: string }) {
    return this.platform.generateBillingInvoices(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('billing/enforce') enforceBilling(@Body() body: { workspaceId?: string } = {}) {
    return this.platform.enforceBilling(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('billing/remind') runBillingReminders(@Body() body: { workspaceId?: string } = {}) {
    return this.platform.runBillingReminders(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Post('billing/invoices/verify-proof') verifyPaymentProof(@Body() body: {
    workspaceId?: string; invoiceId?: string; approve?: boolean; notes?: string;
  }) {
    return this.platform.verifyPaymentProof(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Patch('billing/invoices') updateBillingInvoice(@Body() body: {
    id?: string; status?: string; amount?: number; notes?: string; planName?: string; description?: string;
  }) {
    return this.platform.updateBillingInvoice(body);
  }

  @Roles('PLATFORM_ADMIN')
  @Get('billing/invoices/document') billingInvoiceDocument(@Query('id') id?: string) {
    return this.platform.billingInvoiceDocument(id);
  }
}
