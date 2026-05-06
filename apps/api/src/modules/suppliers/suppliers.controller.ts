/**
 * SuppliersController — Phase 4 P4-2.
 *
 * All endpoints require authentication (global JwtAuthGuard) AND a specific
 * permission via `@RequirePermission(...)`.
 */

import {
  type CreateSupplierInput,
  type ListSuppliersQuery,
  type UpdateSupplierInput,
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
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
import { SuppliersService } from './suppliers.service';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  // ─── List ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('suppliers.view')
  @ApiOperation({ summary: 'قائمة الموردين (بحث + ترقيم + فلاتر)' })
  @UsePipes(new ZodValidationPipe(listSuppliersQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListSuppliersQuery) {
    return this.suppliers.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  // ─── Detail ────────────────────────────────────────────────
  @Get(':id')
  @RequirePermission('suppliers.view')
  @ApiOperation({ summary: 'تفاصيل المورّد' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Balance ───────────────────────────────────────────────
  @Get(':id/balance')
  @RequirePermission('suppliers.view_balance')
  @ApiOperation({ summary: 'رصيد المورّد (مختصر)' })
  balance(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.getBalance({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Statement ─────────────────────────────────────────────
  @Get(':id/statement')
  @RequirePermission('suppliers.view_transactions')
  @ApiOperation({ summary: 'كشف حساب المورّد' })
  statement(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliers.statement(
      { storeId: actor.storeId, actorId: actor.id },
      id,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  // ─── Create ────────────────────────────────────────────────
  @Post()
  @RequirePermission('suppliers.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierSchema))
  @ApiOperation({ summary: 'إنشاء مورّد + رصيد افتتاحي اختياري' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateSupplierInput) {
    return this.suppliers.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  // ─── Update ────────────────────────────────────────────────
  @Patch(':id')
  @RequirePermission('suppliers.update')
  @UsePipes(new ZodValidationPipe(updateSupplierSchema))
  @ApiOperation({ summary: 'تعديل بيانات المورّد' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSupplierInput,
  ) {
    return this.suppliers.update({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Soft delete ───────────────────────────────────────────
  @Delete(':id')
  @RequirePermission('suppliers.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف المورّد (soft) — ممنوع لو الرصيد ≠ 0' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.remove({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Restore ───────────────────────────────────────────────
  @Post(':id/restore')
  @RequirePermission('suppliers.restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استعادة مورّد محذوف' })
  restore(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.restore({ storeId: actor.storeId, actorId: actor.id }, id);
  }
}
