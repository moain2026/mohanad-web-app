import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';
import { PasswordResetsModule } from '../password-resets/password-resets.module';
import { SettingsModule } from '../settings/settings.module';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SettingsModule,
    NotificationTemplatesModule,
    PasswordResetsModule,
    IdempotencyModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
