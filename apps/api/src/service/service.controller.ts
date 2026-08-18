import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ServiceService } from './service.service';
import { Roles } from '../auth/roles.decorator';

@Controller('service')
export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('customers') customers() { return this.service.listCustomers(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('customers') createCustomer(@Body() body: object) { return this.service.createCustomer(body); }
  @Get('services') services() { return this.service.listServices(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('services') createService(@Body() body: object) { return this.service.createService(body); }
  @Get('orders') orders() { return this.service.listOrders(); }
  @Get('orders/:id') order(@Param('id') id: string) { return this.service.getOrder(id); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('orders') createOrder(@Body() body: object) { return this.service.createOrder(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF', 'TECHNICIAN')
  @Patch('orders/:id/status') status(@Param('id') id: string, @Body() body: object) { return this.service.updateOrderStatus(id, body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Patch('orders/:id/payment') payment(@Param('id') id: string, @Body() body: object) { return this.service.updatePayment(id, body); }
  @Get('assets') assets() { return this.service.listAssets(); }
  @Get('assets/:id/history') assetHistory(@Param('id') id: string) { return this.service.assetHistory(id); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('assets') createAsset(@Body() body: object) { return this.service.createAsset(body); }
  @Get('members') members() { return this.service.listMembers(); }
  @Roles('OWNER', 'ADMIN')
  @Post('members') inviteMember(@Body() body: object) { return this.service.inviteMember(body); }
  @Get('finance') finance() { return this.service.financeSummary(); }
  @Get('reports') reports(@Query('from') from?: string, @Query('to') to?: string) { return this.service.report({ from, to }); }
  @Get('documents/work-order') docWo(@Query('id') id?: string) { return this.service.documentWorkOrder(id); }
  @Get('documents/invoice') docInv(@Query('id') id?: string) { return this.service.documentInvoice(id); }
  @Get('documents/receipt') docRcpt(@Query('id') id?: string) { return this.service.documentReceipt(id); }
  @Get('quotations') quotations() { return this.service.listQuotations(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('quotations') createQuotation(@Body() body: object) { return this.service.createQuotation(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('quotations/:id/convert') convertQuotation(@Param('id') id: string) { return this.service.convertQuotation(id); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Patch('quotations/:id/status') quotationStatus(@Param('id') id: string, @Body() body: object) {
    return this.service.updateQuotationStatus(id, body);
  }
  @Get('documents/quotation') docQt(@Query('id') id?: string) { return this.service.documentQuotation(id); }
}
