import { Module, forwardRef } from '@nestjs/common';

import { DailyIncomeModule } from '../daily-income/daily-income.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [forwardRef(() => DailyIncomeModule)],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
