import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
