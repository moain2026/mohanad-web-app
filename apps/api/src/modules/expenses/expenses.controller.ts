/**
 * ExpensesController — Phase 5 P5-2.
 *
 * Single create endpoint dispatches on body.type (NORMAL / SUPPLIER_PAYMENT /
 * CASH_PURCHASE_LINK). Permission gates use the coarse `expenses.create`
 * code today; finer-grained gates (`expenses.create_normal`,
 * `expenses.create_supplier_payment`) are checked at the service layer in
 * a future audit pass — same approach as `purchases.create`.
 */

import {
  type CancelExpenseInput,
  type CreateExpenseInput,
  type ListExpensesQuery,
  cancelExpenseSchema,
  createExpenseSchema,
  listExpensesQuerySchema,
} from '@grocery/shared';
import {
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
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth('access-token')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('expenses.view')
  @ApiOperation({ summary: 'قائمة المصروفات (بحث + ترقيم + فلاتر)' })
  @UsePipes(new ZodValidationPipe(listExpensesQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListExpensesQuery) {
    return this.expenses.list(this.scope(actor), query);
  }

  @Get(':id')
  @RequirePermission('expenses.view')
  @ApiOperation({ summary: 'تفاصيل مصروف' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.expenses.findOne(this.scope(actor), id);
  }

  @Post()
  @RequirePermission('expenses.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createExpenseSchema))
  @ApiOperation({
    summary:
      'إنشاء مصروف — NORMAL (عادي) / SUPPLIER_PAYMENT (يخفّض رصيد المورّد ذرّياً) / CASH_PURCHASE_LINK (ربط بفاتورة نقدية موجودة بدون أثر مالي إضافي)',
  })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateExpenseInput) {
    return this.expenses.create(this.scope(actor), body);
  }

  @Post(':id/cancel')
  @RequirePermission('expenses.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelExpenseSchema))
  @ApiOperation({
    summary: 'إلغاء مصروف (SUPPLIER_PAYMENT يعكس رصيد المورّد ذرّياً)',
  })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelExpenseInput,
  ) {
    return this.expenses.cancel(this.scope(actor), id, body);
  }
}
