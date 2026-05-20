/**
 * Reports API client (Phase 7).
 */
import { apiGet } from '../api';

export interface DashboardData {
  today: {
    date: string;
    salesTotal: number;
    salesCount: number;
    cashSales: number;
    creditSales: number;
    expenses: number;
    netProfit: number;
    closingCash: number;
  };
  month: {
    salesTotal: number;
    salesCount: number;
    expenses: number;
    netProfit: number;
  };
  customers: { total: number; withDebt: number; totalDebt: number };
  suppliers: { total: number };
  inventory: { lowStockCount: number };
  notifications: { unread: number };
  charts: {
    last7Days: Array<{ date: string; sales: number; expenses: number; net: number }>;
  };
}

export interface DailySummaryData {
  date: string;
  openingCash: number;
  sales: { cashSales: number; creditSales: number; total: number; countByMode: Array<{ mode: string; count: number }> };
  purchases: { cashTotal: number; cashCount: number; creditTotal: number; creditCount: number };
  expenses: { normal: number; supplierPayments: number; total: number };
  customerPayments: number;
  closingCash: number;
  isClosed: boolean;
  netProfit: number;
}

export interface ProfitLossData {
  range: { from: string; to: string };
  sales: { cashSales: number; creditSales: number; totalSales: number };
  purchases: { cashPurchases: number; creditPurchases: number; totalPurchases: number };
  expenses: { normal: number };
  grossProfit: number;
  netProfit: number;
  isEstimated: boolean;
}

export interface CashFlowData {
  range: { from: string; to: string };
  inflows: { cashSales: number; customerPayments: number; total: number };
  outflows: { cashPurchases: number; normalExpenses: number; supplierPayments: number; total: number };
  net: number;
}

export interface DebtsAgeingData {
  asOf: string;
  summary: { total: number; totalDebt: number; byBucket: Record<string, { count: number; debt: number }> };
  items: Array<{
    id: string;
    name: string;
    phone: string | null;
    balance: number;
    creditLimit: number | null;
    status: string;
    lastDebtAt: string | null;
    ageDays: number;
    bucket: string;
  }>;
}

export interface SupplierBalancesData {
  asOf: string;
  summary: { total: number; totalOwed: number; suppliersWithBalance: number };
  items: Array<{ id: string; name: string; phone: string | null; balance: number; isActive: boolean }>;
}

export interface TopCustomersData {
  range: { from: string; to: string };
  items: Array<{
    customerId: string | null;
    customerName: string;
    customerPhone: string | null;
    currentBalance: number;
    salesTotal: number;
    salesCount: number;
  }>;
}

export interface TopItemsData {
  range: { from: string; to: string };
  items: Array<{ name: string; quantity: number; revenue: number; salesCount: number }>;
}

export interface CategoryReportData {
  range: { from: string; to: string };
  summary: { totalAmount: number; categoryCount: number };
  items: Array<{ categoryId: string; categoryName: string; amount: number; count: number; percentage: number }>;
}

export interface ModeReportData {
  range: { from: string; to: string };
  summary: { total: number; modeCount: number };
  items: Array<{ mode: string; amount: number; count: number; percentage: number }>;
}

export interface WorkerReportData {
  range: { from: string; to: string };
  items: Array<{ userId: string; username: string; fullName: string; salesTotal: number; salesCount: number }>;
}

export interface MonthlySummaryData {
  month: string;
  from: string;
  to: string;
  profitLoss: ProfitLossData;
  cashFlow: CashFlowData;
  dailyBreakdown: Array<{
    date: string;
    cashSales: number;
    creditSales: number;
    normalExpenses: number;
    closingCash: number;
    isClosed: boolean;
  }>;
}

function buildQuery(params?: Record<string, string | number | Date | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of entries) {
    sp.append(k, v instanceof Date ? v.toISOString() : String(v));
  }
  return `?${sp.toString()}`;
}

export const reportsApi = {
  dashboard: () => apiGet<DashboardData>('/reports/dashboard'),
  dailySummary: (date?: Date) =>
    apiGet<DailySummaryData>(`/reports/daily-summary${buildQuery({ date })}`),
  profitLoss: (from?: Date, to?: Date) =>
    apiGet<ProfitLossData>(`/reports/profit-loss${buildQuery({ from, to })}`),
  cashFlow: (from?: Date, to?: Date) =>
    apiGet<CashFlowData>(`/reports/cash-flow${buildQuery({ from, to })}`),
  customerDebts: (asOf?: Date) =>
    apiGet<DebtsAgeingData>(`/reports/customer-debts${buildQuery({ asOf })}`),
  supplierBalances: (asOf?: Date) =>
    apiGet<SupplierBalancesData>(`/reports/supplier-balances${buildQuery({ asOf })}`),
  topCustomers: (from?: Date, to?: Date, limit = 10) =>
    apiGet<TopCustomersData>(`/reports/top-customers${buildQuery({ from, to, limit })}`),
  topItems: (from?: Date, to?: Date, limit = 10) =>
    apiGet<TopItemsData>(`/reports/top-items${buildQuery({ from, to, limit })}`),
  expensesByCategory: (from?: Date, to?: Date) =>
    apiGet<CategoryReportData>(`/reports/expenses-by-category${buildQuery({ from, to })}`),
  salesByMode: (from?: Date, to?: Date) =>
    apiGet<ModeReportData>(`/reports/sales-by-mode${buildQuery({ from, to })}`),
  salesByWorker: (from?: Date, to?: Date) =>
    apiGet<WorkerReportData>(`/reports/sales-by-worker${buildQuery({ from, to })}`),
  monthlySummary: (month?: string) =>
    apiGet<MonthlySummaryData>(`/reports/monthly-summary${buildQuery({ month })}`),
};
