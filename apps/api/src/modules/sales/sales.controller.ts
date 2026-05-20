/**
 * SalesController — Phase 6 P6-2.
 *
 * Single create endpoint dispatches on body.mode (QUICK / DETAILED / CREDIT).
 * Permission gating uses the coarse `sales.create` code; finer-grained
 * codes (`sales.create_quick`, `sales.create_detailed`, `sales.create_credit`)
 * will be checked at the service layer in a future audit pass — same
 * approach as `purchases.create`.
 */

import {
  type CancelSaleInput,
  type CreateSaleInput,
  type ListSalesQuery,
  cancelSaleSchema,
  createSaleSchema,
  listSalesQuerySchema,
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
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  private scope(actor: AuthUser) {
    return {
      storeId: actor.storeId,
      actorId: actor.id,
      permissions: actor.permissions,
    };
  }

  @Get()
  @RequirePermission('sales.view')
  @ApiOperation({ summary: 'قائمة المبيعات (بحث + ترقيم + فلاتر)' })
  @UsePipes(new ZodValidationPipe(listSalesQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListSalesQuery) {
    return this.sales.list(this.scope(actor), query);
  }

  @Get(':id')
  @RequirePermission('sales.view')
  @ApiOperation({ summary: 'تفاصيل عملية بيع (مع العناصر)' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.sales.findOne(this.scope(actor), id);
  }

  @Post()
  @RequirePermission('sales.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSaleSchema))
  @ApiOperation({
    summary:
      'إنشاء عملية بيع — QUICK (نقدي سريع) / DETAILED (نقدي بعناصر) / CREDIT (آجل + يزيد رصيد العميل ذرّياً)',
  })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateSaleInput) {
    return this.sales.create(this.scope(actor), body);
  }

  @Post(':id/cancel')
  @RequirePermission('sales.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelSaleSchema))
  @ApiOperation({
    summary: 'إلغاء عملية البيع (CREDIT يعكس رصيد العميل ذرّياً)',
  })
  cancel(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: CancelSaleInput) {
    return this.sales.cancel(this.scope(actor), id, body);
  }
}
