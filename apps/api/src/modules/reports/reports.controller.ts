import {
  customerDebtsQuerySchema,
  dailySummaryQuerySchema,
  dateRangeSchema,
  monthlySummaryQuerySchema,
  supplierBalancesQuerySchema,
  topNQuerySchema,
} from '@grocery/shared';
import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get('dashboard')
  @RequirePermission('reports.dashboard.view')
  @ApiOperation({ summary: 'KPIs لوحة التحكم (اليوم + الشهر + التنبيهات)' })
  dashboard(@CurrentUser() actor: AuthUser) {
    return this.reports.dashboard(this.scope(actor));
  }

  @Get('daily-summary')
  @RequirePermission('reports.daily_summary.view')
  @ApiOperation({ summary: 'ملخص اليوم' })
  @UsePipes(new ZodValidationPipe(dailySummaryQuerySchema, 'query'))
  dailySummary(@CurrentUser() actor: AuthUser, @Query() q: { date?: Date }) {
    return this.reports.dailySummary(this.scope(actor), q.date);
  }

  @Get('profit-loss')
  @RequirePermission('reports.profit_loss.view')
  @ApiOperation({ summary: 'الأرباح والخسائر لنطاق زمني' })
  @UsePipes(new ZodValidationPipe(dateRangeSchema, 'query'))
  profitLoss(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date }) {
    return this.reports.profitLoss(this.scope(actor), q.from, q.to);
  }

  @Get('cash-flow')
  @RequirePermission('reports.cash_flow.view')
  @ApiOperation({ summary: 'التدفق النقدي لنطاق زمني' })
  @UsePipes(new ZodValidationPipe(dateRangeSchema, 'query'))
  cashFlow(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date }) {
    return this.reports.cashFlow(this.scope(actor), q.from, q.to);
  }

  @Get('customer-debts')
  @RequirePermission('reports.customer_debts.view')
  @ApiOperation({ summary: 'تقادم ديون العملاء' })
  @UsePipes(new ZodValidationPipe(customerDebtsQuerySchema, 'query'))
  customerDebts(@CurrentUser() actor: AuthUser, @Query() q: { asOf?: Date }) {
    return this.reports.customerDebts(this.scope(actor), q.asOf);
  }

  @Get('supplier-balances')
  @RequirePermission('reports.supplier_debts.view')
  @ApiOperation({ summary: 'أرصدة الموردين' })
  @UsePipes(new ZodValidationPipe(supplierBalancesQuerySchema, 'query'))
  supplierBalances(@CurrentUser() actor: AuthUser, @Query() q: { asOf?: Date }) {
    return this.reports.supplierBalances(this.scope(actor), q.asOf);
  }

  @Get('top-customers')
  @RequirePermission('reports.sales.view')
  @ApiOperation({ summary: 'أفضل العملاء حسب المبيعات' })
  @UsePipes(new ZodValidationPipe(topNQuerySchema, 'query'))
  topCustomers(
    @CurrentUser() actor: AuthUser,
    @Query() q: { from?: Date; to?: Date; limit: number },
  ) {
    return this.reports.topCustomers(this.scope(actor), q.from, q.to, q.limit);
  }

  @Get('top-items')
  @RequirePermission('reports.sales.view')
  @ApiOperation({ summary: 'أفضل الأصناف حسب الإيراد' })
  @UsePipes(new ZodValidationPipe(topNQuerySchema, 'query'))
  topItems(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date; limit: number }) {
    return this.reports.topItems(this.scope(actor), q.from, q.to, q.limit);
  }

  @Get('expenses-by-category')
  @RequirePermission('reports.expenses.view')
  @ApiOperation({ summary: 'المصاريف حسب الفئة' })
  @UsePipes(new ZodValidationPipe(dateRangeSchema, 'query'))
  expensesByCategory(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date }) {
    return this.reports.expensesByCategory(this.scope(actor), q.from, q.to);
  }

  @Get('sales-by-mode')
  @RequirePermission('reports.sales.view')
  @ApiOperation({ summary: 'المبيعات حسب الوضع' })
  @UsePipes(new ZodValidationPipe(dateRangeSchema, 'query'))
  salesByMode(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date }) {
    return this.reports.salesByMode(this.scope(actor), q.from, q.to);
  }

  @Get('sales-by-worker')
  @RequirePermission('reports.sales.view')
  @ApiOperation({ summary: 'المبيعات حسب البائع' })
  @UsePipes(new ZodValidationPipe(dateRangeSchema, 'query'))
  salesByWorker(@CurrentUser() actor: AuthUser, @Query() q: { from?: Date; to?: Date }) {
    return this.reports.salesByWorker(this.scope(actor), q.from, q.to);
  }

  @Get('monthly-summary')
  @RequirePermission('reports.monthly_summary.view')
  @ApiOperation({ summary: 'ملخص الشهر' })
  @UsePipes(new ZodValidationPipe(monthlySummaryQuerySchema, 'query'))
  monthlySummary(@CurrentUser() actor: AuthUser, @Query() q: { month?: string }) {
    return this.reports.monthlySummary(this.scope(actor), q.month);
  }
}
