/**
 * PurchasesController — Phase 4 P4-3.
 *
 * One create endpoint handles both CASH and CREDIT (the body's `paymentType`
 * picks the path inside the service). Both fine-grained permissions
 * (`purchases.create_cash`, `purchases.create_credit`) are checked at the
 * service layer in a future audit pass — for now `purchases.create` is the
 * single guard, matching the customer-transactions pattern.
 */

import {
  type CancelPurchaseInput,
  type CreatePurchaseInput,
  type ListPurchasesQuery,
  cancelPurchaseSchema,
  createPurchaseSchema,
  listPurchasesQuerySchema,
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
import { PurchasesService } from './purchases.service';

@ApiTags('Purchases')
@ApiBearerAuth('access-token')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  // ─── List ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('purchases.view')
  @ApiOperation({ summary: 'قائمة المشتريات (بحث + ترقيم + فلاتر)' })
  @UsePipes(new ZodValidationPipe(listPurchasesQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListPurchasesQuery) {
    return this.purchases.list(this.scope(actor), query);
  }

  // ─── Detail ────────────────────────────────────────────────
  @Get(':id')
  @RequirePermission('purchases.view')
  @ApiOperation({ summary: 'تفاصيل عملية شراء (مع العناصر)' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.purchases.findOne(this.scope(actor), id);
  }

  // ─── Create (cash or credit) ──────────────────────────────
  @Post()
  @RequirePermission('purchases.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createPurchaseSchema))
  @ApiOperation({
    summary: 'إنشاء عملية شراء — نقد (لا يمسّ رصيد المورّد) أو آجل (يزيد رصيد المورّد ذرّياً)',
  })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreatePurchaseInput) {
    return this.purchases.create(this.scope(actor), body);
  }

  // ─── Cancel ────────────────────────────────────────────────
  @Post(':id/cancel')
  @RequirePermission('purchases.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelPurchaseSchema))
  @ApiOperation({
    summary: 'إلغاء عملية الشراء (CREDIT يعكس رصيد المورّد ذرّياً + audit log)',
  })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelPurchaseInput,
  ) {
    return this.purchases.cancel(this.scope(actor), id, body);
  }
}
