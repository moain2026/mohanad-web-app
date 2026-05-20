import { Module, forwardRef } from '@nestjs/common';

import { DailyIncomeModule } from '../daily-income/daily-income.module';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [forwardRef(() => DailyIncomeModule)],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService, ExpenseCategoriesService],
  exports: [ExpensesService, ExpenseCategoriesService],
})
export class ExpensesModule {}
