import { Module } from '@nestjs/common';

import { DailyIncomeController } from './daily-income.controller';
import { DailyIncomeService } from './daily-income.service';

@Module({
  controllers: [DailyIncomeController],
  providers: [DailyIncomeService],
  exports: [DailyIncomeService],
})
export class DailyIncomeModule {}
