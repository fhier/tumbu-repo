import { Module, forwardRef } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { ErpModule } from '../erp/erp.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { ReminderModule } from '../reminder/reminder.module';

@Module({
  imports: [ErpModule, forwardRef(() => AuthModule), ReminderModule, EmailModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
