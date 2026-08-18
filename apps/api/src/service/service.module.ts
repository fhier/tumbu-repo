import { Module } from '@nestjs/common';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [ErpModule],
  controllers: [ServiceController],
  providers: [ServiceService],
})
export class ServiceModule {}
