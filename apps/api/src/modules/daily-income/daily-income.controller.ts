/**
 * DailyIncomeController — Phase 5 P5-3.
 *
 * Endpoints:
 *   GET    /daily-income            → list with date filters
 *   GET    /daily-income/today      → convenience: today's row
 *   GET    /daily-income/:date      → row for date YYYY-MM-DD (lazy-create)
 *   POST   /daily-income/open       → open day (set openingCash)
 *   POST   /daily-income/close      → close day (immutable thereafter)
 *   POST   /daily-income/recompute  → admin-only manual recompute
 */

import {
  type CloseDayInput,
  type ListDailyIncomeQuery,
  type OpenDayInput,
  type RecomputeDayInput,
  closeDaySchema,
  listDailyIncomeQuerySchema,
  openDaySchema,
  recomputeDaySchema,
} from '@grocery/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { DailyIncomeService } from './daily-income.service';

@ApiTags('Daily Income')
@ApiBearerAuth('access-token')
@Controller('daily-income')
export class DailyIncomeController {
  constructor(private readonly daily: DailyIncomeService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('daily_income.view')
  @ApiOperation({ summary: 'سجل الإيراد اليومي (قائمة بفلاتر تاريخ)' })
  @UsePipes(new ZodValidationPipe(listDailyIncomeQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListDailyIncomeQuery) {
    return this.daily.list(this.scope(actor), query);
  }

  @Get('today')
  @RequirePermission('daily_income.view')
  @ApiOperation({ summary: 'إيراد اليوم الحالي (يُحتسب لحظياً)' })
  async today(@CurrentUser() actor: AuthUser) {
    await this.daily.recompute(actor.storeId, new Date());
    return this.daily.getByDate(this.scope(actor), new Date());
  }

  @Get(':date')
  @RequirePermission('daily_income.view')
  @ApiOperation({ summary: 'إيراد يوم محدد (YYYY-MM-DD)' })
  byDate(@CurrentUser() actor: AuthUser, @Param('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException({
        message: 'الصيغة المطلوبة: YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT',
      });
    }
    return this.daily.getByDate(this.scope(actor), new Date(`${date}T00:00:00.000Z`));
  }

  @Post('open')
  @RequirePermission('daily_income.create')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(openDaySchema))
  @ApiOperation({ summary: 'فتح اليوم (تحديد رصيد الصندوق الافتتاحي)' })
  open(@CurrentUser() actor: AuthUser, @Body() body: OpenDayInput) {
    return this.daily.openDay(this.scope(actor), body);
  }

  @Post('close')
  @RequirePermission('daily_income.approve')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(closeDaySchema))
  @ApiOperation({ summary: 'إغلاق اليوم (يصبح السجل غير قابل للتعديل)' })
  close(@CurrentUser() actor: AuthUser, @Body() body: CloseDayInput) {
    return this.daily.closeDay(this.scope(actor), body);
  }

  @Post('recompute')
  @RequirePermission('daily_income.update')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(recomputeDaySchema))
  @ApiOperation({ summary: 'إعادة احتساب يوم (أداة إصلاح يدوية)' })
  recompute(@CurrentUser() actor: AuthUser, @Body() body: RecomputeDayInput) {
    return this.daily.recompute(actor.storeId, body.date, actor.id);
  }
}
