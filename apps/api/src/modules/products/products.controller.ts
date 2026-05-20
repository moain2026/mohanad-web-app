import {
  type CreateProductInput,
  type ListProductsQuery,
  type UpdateProductInput,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
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
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('products.view')
  @UsePipes(new ZodValidationPipe(listProductsQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() q: ListProductsQuery) {
    return this.products.list(this.scope(actor), q);
  }

  @Get('stock-summary')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'ملخص المخزون (عدد المنتجات، منخفض المخزون...)' })
  stockSummary(@CurrentUser() actor: AuthUser) {
    return this.products.stockSummary(this.scope(actor));
  }

  @Get(':id')
  @RequirePermission('products.view')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.products.findOne(this.scope(actor), id);
  }

  @Post()
  @RequirePermission('products.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createProductSchema))
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateProductInput) {
    return this.products.create(this.scope(actor), body);
  }

  @Patch(':id')
  @RequirePermission('products.update')
  @UsePipes(new ZodValidationPipe(updateProductSchema))
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateProductInput,
  ) {
    return this.products.update(this.scope(actor), id, body);
  }

  @Delete(':id')
  @RequirePermission('products.archive')
  archive(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.products.archive(this.scope(actor), id);
  }

  @Post(':id/restore')
  @RequirePermission('products.activate')
  restore(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.products.restore(this.scope(actor), id);
  }
}
