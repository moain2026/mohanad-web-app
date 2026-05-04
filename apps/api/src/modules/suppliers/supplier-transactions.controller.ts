/**
 * SupplierTransactionsController — Phase 4 P4-2.
 *
 * Routes nested under /suppliers/:id/transactions to mirror the customer
 * transaction URL space.
 *
 * Note: CREDIT_PURCHASE rows are NOT created here — they are created
 * atomically by `PurchasesService.createCreditPurchase`. This controller
 * exposes PAYMENT, ADJUSTMENT, list, and cancel.
 */

import {
  type CancelSupplierTransactionInput,
  type CreateSupplierAdjustmentInput,
  type CreateSupplierPaymentInput,
  type ListSupplierTransactionsQuery,
  cancelSupplierTransactionSchema,
  createSupplierAdjustmentSchema,
  createSupplierPaymentSchema,
  listSupplierTransactionsQuerySchema,
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
import { SupplierTransactionsService } from './supplier-transactions.service';

@ApiTags('Supplier Transactions')
@ApiBearerAuth('access-token')
@Controller('suppliers/:id/transactions')
export class SupplierTransactionsController {
  constructor(private readonly tx: SupplierTransactionsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  // ─── List ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('supplier_transactions.view')
  @ApiOperation({ summary: 'حركات حساب المورّد (شراء/سداد/تسوية)' })
  @UsePipes(new ZodValidationPipe(listSupplierTransactionsQuerySchema, 'query'))
  list(
    @CurrentUser() actor: AuthUser,
    @Param('id') supplierId: string,
    @Query() query: ListSupplierTransactionsQuery,
  ) {
    return this.tx.list(this.scope(actor), supplierId, query);
  }

  // ─── Create PAYMENT ────────────────────────────────────────
  @Post('payment')
  @RequirePermission('supplier_transactions.create_payment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierPaymentSchema))
  @ApiOperation({ summary: 'تسجيل دفعة للمورّد (atomic)' })
  createPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id') supplierId: string,
    @Body() body: CreateSupplierPaymentInput,
  ) {
    return this.tx.createPayment(this.scope(actor), supplierId, body);
  }

  // ─── Create ADJUSTMENT ────────────────────────────────────
  @Post('adjustment')
  @RequirePermission('supplier_transactions.create_adjustment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierAdjustmentSchema))
  @ApiOperation({ summary: 'تسوية رصيد المورّد (موجبة/سالبة + سبب إجباري)' })
  createAdjustment(
    @CurrentUser() actor: AuthUser,
    @Param('id') supplierId: string,
    @Body() body: CreateSupplierAdjustmentInput,
  ) {
    return this.tx.createAdjustment(this.scope(actor), supplierId, body);
  }

  // ─── Cancel ────────────────────────────────────────────────
  @Post(':txId/cancel')
  @RequirePermission('supplier_transactions.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelSupplierTransactionSchema))
  @ApiOperation({ summary: 'إلغاء حركة (يعكس الرصيد + audit log)' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') supplierId: string,
    @Param('txId') txId: string,
    @Body() body: CancelSupplierTransactionInput,
  ) {
    return this.tx.cancel(this.scope(actor), supplierId, txId, body);
  }
}
