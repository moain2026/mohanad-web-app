import { Module } from '@nestjs/common';

import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StockMovementsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
