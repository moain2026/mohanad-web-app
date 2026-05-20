/**
 * Daily Income API client (Phase 5 Frontend).
 */

import type {
  CloseDayInput,
  ListDailyIncomeQuery,
  OpenDayInput,
  RecomputeDayInput,
} from '@grocery/shared';

import { apiGet, apiPost } from '../api';
import type { Paged } from './purchases';

export interface DailyIncome {
  id: string;
  storeId: string;
  date: string;
  openingCash: string | number;
  cashSales: string | number;
  creditSales: string | number;
  customerPayments: string | number;
  cashPurchases: string | number;
  supplierPayments: string | number;
  normalExpenses: string | number;
  closingCash: string | number;
  notes: string | null;
  closedAt: string | null;
  closedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export const dailyIncomeApi = {
  list: (params: Partial<ListDailyIncomeQuery> = {}) =>
    apiGet<Paged<DailyIncome>>('/daily-income', { params }),
  today: () => apiGet<DailyIncome>('/daily-income/today'),
  byDate: (date: string /* YYYY-MM-DD */) => apiGet<DailyIncome>(`/daily-income/${date}`),
  open: (data: OpenDayInput) => apiPost<DailyIncome, OpenDayInput>('/daily-income/open', data),
  close: (data: CloseDayInput) => apiPost<DailyIncome, CloseDayInput>('/daily-income/close', data),
  recompute: (data: RecomputeDayInput) =>
    apiPost<DailyIncome, RecomputeDayInput>('/daily-income/recompute', data),
};
