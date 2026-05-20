/**
 * Expenses + Expense Categories API client (Phase 5 Frontend).
 *
 * Single create endpoint handles the three modes (NORMAL / SUPPLIER_PAYMENT /
 * CASH_PURCHASE_LINK) — the server dispatches on body.type.
 */

import type {
  CancelExpenseInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  ListExpenseCategoriesQuery,
  ListExpensesQuery,
  UpdateExpenseCategoryInput,
} from '@grocery/shared';

import { apiDelete, apiGet, apiPatch, apiPost } from '../api';
import type { Paged } from './purchases';

// ─── Types ────────────────────────────────────────────────────────
export type ExpenseType = 'NORMAL' | 'SUPPLIER_PAYMENT' | 'CASH_PURCHASE_LINK';

export interface ExpenseCategory {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Expense {
  id: string;
  storeId: string;
  categoryId: string;
  type: ExpenseType;
  amount: string | number;
  description: string;
  expenseDate: string;
  referenceType: string | null;
  referenceId: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancelReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt?: string;
  category?: { id: string; name: string };
  createdBy?: { id: string; username: string; fullName: string };
  cancelledBy?: { id: string; username: string; fullName: string } | null;
}

// ─── Expenses ─────────────────────────────────────────────────────
export const expensesApi = {
  list: (params: Partial<ListExpensesQuery> = {}) =>
    apiGet<Paged<Expense>>('/expenses', { params }),
  get: (id: string) => apiGet<Expense>(`/expenses/${id}`),
  create: (data: CreateExpenseInput) => apiPost<Expense, CreateExpenseInput>('/expenses', data),
  cancel: (id: string, data: CancelExpenseInput) =>
    apiPost<Expense, CancelExpenseInput>(`/expenses/${id}/cancel`, data),
};

// ─── Expense Categories ──────────────────────────────────────────
export const expenseCategoriesApi = {
  list: (params: Partial<ListExpenseCategoriesQuery> = {}) =>
    apiGet<Paged<ExpenseCategory>>('/expense-categories', { params }),
  get: (id: string) => apiGet<ExpenseCategory>(`/expense-categories/${id}`),
  create: (data: CreateExpenseCategoryInput) =>
    apiPost<ExpenseCategory, CreateExpenseCategoryInput>('/expense-categories', data),
  update: (id: string, data: UpdateExpenseCategoryInput) =>
    apiPatch<ExpenseCategory, UpdateExpenseCategoryInput>(`/expense-categories/${id}`, data),
  remove: (id: string) => apiDelete<{ id: string }>(`/expense-categories/${id}`),
};
