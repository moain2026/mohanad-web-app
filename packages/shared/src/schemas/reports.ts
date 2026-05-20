/**
 * Reports — Zod schemas for Phase 7.
 *
 * Reports are computed on-the-fly by ReportsService. The shared schemas
 * here are the **input** contracts (date ranges, filters) and the
 * **canonical type names** that map 1:1 to the 11 report types.
 *
 * Canonical types (LOCKED):
 *   • dashboard            — KPI summary for the home page (today + this month)
 *   • daily_summary        — Full P&L for ONE day (cash book)
 *   • profit_loss          — P&L for an arbitrary range
 *   • cash_flow            — Cash movements for a range
 *   • customer_debts       — Snapshot of who owes what (ageing buckets)
 *   • supplier_balances    — Snapshot of supplier balances
 *   • top_customers        — Top N customers by revenue or debt
 *   • top_items            — Top N items by quantity / value (Phase 9+)
 *   • expenses_by_category — Σ expenses grouped by category for a range
 *   • sales_by_mode        — Σ sales grouped by mode (QUICK/DETAILED/CREDIT)
 *   • sales_by_worker      — Σ sales grouped by createdBy for a range
 *   • monthly_summary      — Full P&L for ONE calendar month
 */

import { z } from 'zod';

// ─── Canonical type list ────────────────────────────────
export const REPORT_TYPES = [
  'dashboard',
  'daily_summary',
  'profit_loss',
  'cash_flow',
  'customer_debts',
  'supplier_balances',
  'top_customers',
  'top_items',
  'expenses_by_category',
  'sales_by_mode',
  'sales_by_worker',
  'monthly_summary',
] as const;

export const reportTypeSchema = z.enum(REPORT_TYPES);
export type ReportType = z.infer<typeof reportTypeSchema>;

// ─── Common range filter ────────────────────────────────
export const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'تاريخ البداية يجب أن يسبق تاريخ النهاية',
    path: ['to'],
  });

export const dailySummaryQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const monthlySummaryQuerySchema = z.object({
  // ISO month "YYYY-MM" — coerced via custom parser in service.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'صيغة الشهر يجب أن تكون YYYY-MM')
    .optional(),
});

export const topNQuerySchema = dateRangeSchema.and(
  z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
);

export const customerDebtsQuerySchema = z.object({
  // ISO date — defaults to "now"
  asOf: z.coerce.date().optional(),
});

export const supplierBalancesQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type MonthlySummaryQuery = z.infer<typeof monthlySummaryQuerySchema>;
export type TopNQuery = z.infer<typeof topNQuerySchema>;
export type CustomerDebtsQuery = z.infer<typeof customerDebtsQuerySchema>;
export type SupplierBalancesQuery = z.infer<typeof supplierBalancesQuerySchema>;
