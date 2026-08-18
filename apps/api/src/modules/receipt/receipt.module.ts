import { Module } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ErpModule } from '../../erp/erp.module';

@Module({
  imports: [PrismaModule, ErpModule],
  controllers: [ReceiptController],
  providers: [ReceiptService],
})
export class ReceiptModule {}
