import { Controller, Get, Query, Post, Param } from '@nestjs/common';
import { ReceiptService } from './receipt.service';

@Controller('receipt')
export class ReceiptController {
  constructor(private readonly receipt: ReceiptService) {}

  @Get('data')
  getData(@Query('transactionId') transactionId: string) {
    return this.receipt.getCanonicalData(transactionId);
  }

  @Post('generate-share-link')
  generateShareLink(@Query('transactionId') transactionId: string) {
    return this.receipt.generateShareToken(transactionId);
  }

  @Get('share/:token')
  getSharedData(@Param('token') token: string) {
    return this.receipt.getSharedData(token);
  }
}
