import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ErpModule } from '../../erp/erp.module';

@Module({
  imports: [PrismaModule, ErpModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
