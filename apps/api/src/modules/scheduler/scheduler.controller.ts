import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { SchedulerService } from './scheduler.service';

@ApiTags('Scheduler')
@ApiBearerAuth('access-token')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly svc: SchedulerService) {}

  @Get('jobs')
  @RequirePermission('system.app_logs.view')
  @ApiOperation({ summary: 'تاريخ تشغيل المهام المجدولة' })
  history(@CurrentUser() actor: AuthUser, @Query('jobKey') jobKey?: string) {
    return this.svc.getJobHistory(actor.storeId, jobKey);
  }

  @Post('jobs/:jobKey/run')
  @RequirePermission('system.app_logs.view')
  @ApiOperation({ summary: 'تشغيل مهمة الآن (يدوياً)' })
  async runNow(@Param('jobKey') jobKey: string) {
    return this.svc.runManually(jobKey);
  }
}
