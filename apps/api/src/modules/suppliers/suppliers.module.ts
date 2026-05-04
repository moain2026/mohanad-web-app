import { Module } from '@nestjs/common';

import { SupplierTransactionsController } from './supplier-transactions.controller';
import { SupplierTransactionsService } from './supplier-transactions.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController, SupplierTransactionsController],
  providers: [SuppliersService, SupplierTransactionsService],
  exports: [SuppliersService, SupplierTransactionsService],
})
export class SuppliersModule {}
