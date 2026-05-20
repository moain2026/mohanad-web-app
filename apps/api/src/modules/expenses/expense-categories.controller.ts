/**
 * ExpenseCategoriesController — Phase 5 P5-2.
 *
 * CRUD endpoints for the per-store expense category catalog. All gated by
 * the single coarse permission `expense_categories.manage` (same approach
 * as the rest of Phase 5 / Phase 4 — admin-style management endpoints).
 */

import {
  type CreateExpenseCategoryInput,
  type ListExpenseCategoriesQuery,
  type UpdateExpenseCategoryInput,
  createExpenseCategorySchema,
  listExpenseCategoriesQuerySchema,
  updateExpenseCategorySchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ExpenseCategoriesService } from './expense-categories.service';

@ApiTags('Expenses')
@ApiBearerAuth('access-token')
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('expenses.view')
  @ApiOperation({ summary: 'قائمة فئات المصروفات' })
  @UsePipes(new ZodValidationPipe(listExpenseCategoriesQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListExpenseCategoriesQuery) {
    return this.categories.list(this.scope(actor), query);
  }

  @Get(':id')
  @RequirePermission('expenses.view')
  @ApiOperation({ summary: 'تفاصيل فئة مصروف' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.categories.findOne(this.scope(actor), id);
  }

  @Post()
  @RequirePermission('expense_categories.manage')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createExpenseCategorySchema))
  @ApiOperation({ summary: 'إنشاء فئة مصروف' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateExpenseCategoryInput) {
    return this.categories.create(this.scope(actor), body);
  }

  @Patch(':id')
  @RequirePermission('expense_categories.manage')
  @UsePipes(new ZodValidationPipe(updateExpenseCategorySchema))
  @ApiOperation({ summary: 'تعديل فئة مصروف' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateExpenseCategoryInput,
  ) {
    return this.categories.update(this.scope(actor), id, body);
  }

  @Delete(':id')
  @RequirePermission('expense_categories.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف فئة مصروف (soft-delete)' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.categories.remove(this.scope(actor), id);
  }
}
