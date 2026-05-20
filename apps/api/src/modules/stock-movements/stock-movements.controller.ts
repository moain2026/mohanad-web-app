import {
  type CancelStockMovementInput,
  type CreateStockMovementInput,
  type ListStockMovementsQuery,
  cancelStockMovementSchema,
  createStockMovementSchema,
  listStockMovementsQuerySchema,
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
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('Stock Movements')
@ApiBearerAuth('access-token')
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('stock_movements.view')
  @ApiOperation({ summary: 'حركات المخزون' })
  @UsePipes(new ZodValidationPipe(listStockMovementsQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() q: ListStockMovementsQuery) {
    return this.movements.list(this.scope(actor), q);
  }

  @Get(':id')
  @RequirePermission('stock_movements.view')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.movements.findOne(this.scope(actor), id);
  }

  @Post()
  @RequireAnyPermission(
    'stock_movements.create_in',
    'stock_movements.create_out',
    'stock_movements.adjust',
  )
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createStockMovementSchema))
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateStockMovementInput) {
    return this.movements.create(this.scope(actor), body);
  }

  @Post(':id/cancel')
  @RequirePermission('stock_movements.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelStockMovementSchema))
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelStockMovementInput,
  ) {
    return this.movements.cancel(this.scope(actor), id, body);
  }
}
