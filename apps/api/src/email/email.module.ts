import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailAdminController } from './email-admin.controller';

@Module({
  controllers: [EmailAdminController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
