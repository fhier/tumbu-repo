import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import * as db from './db';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('clear-workspace')
  clearWorkspace() {
    db.resetPurchaseStorage();
    db.resetSaleStorage();
    db.resetStockStorage();
    db.resetCashStorage();
    db.resetReportingStorage();
    return { status: 'success', message: 'Operational data cleared' };
  }
}
