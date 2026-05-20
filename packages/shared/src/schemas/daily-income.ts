/**
 * Daily Income schemas (Phase 5).
 *
 * المرجع: docs/06-modules.md (الإيراد اليومي) و prisma/schema.prisma.
 *
 * قاعدة محاسبية مقفلة:
 *   closingCash =
 *       openingCash
 *     + cashSales
 *     + customerPayments
 *     − cashPurchases       (من purchases مباشرة — لا من expenses)
 *     − supplierPayments
 *     − normalExpenses
 *
 * بعد ضبط closedAt يصبح اليوم immutable.
 */

import { z } from 'zod';
import { decimalSchema, paginationSchema } from './common';

// ─── Open day ────────────────────────────────────────────────
export const openDaySchema = z.object({
  date: z.coerce.date().optional(),
  openingCash: decimalSchema({ allowZero: true }),
  notes: z.string().trim().max(500).optional(),
});
export type OpenDayInput = z.infer<typeof openDaySchema>;

// ─── Close day ───────────────────────────────────────────────
export const closeDaySchema = z.object({
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CloseDayInput = z.infer<typeof closeDaySchema>;

// ─── Recompute (idempotent) ──────────────────────────────────
/**
 * يُعيد احتساب aggregates لليوم — يُستدعى تلقائياً من الـ Service بعد
 * كل عملية ذات تأثير مالي (مبيع / مصروف / دفعة عميل / مدفوع مورّد).
 *
 * عبر API: مفيد كأداة إصلاح يدوية (admin).
 */
export const recomputeDaySchema = z.object({
  date: z.coerce.date(),
});
export type RecomputeDayInput = z.infer<typeof recomputeDaySchema>;

// ─── List query ──────────────────────────────────────────────
export const listDailyIncomeQuerySchema = paginationSchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  closedOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListDailyIncomeQuery = z.infer<typeof listDailyIncomeQuerySchema>;

export const dailyIncomeDateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'الصيغة المطلوبة: YYYY-MM-DD'),
});
