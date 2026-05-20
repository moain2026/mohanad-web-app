/**
 * Sales + Sale Items schemas (Phase 6).
 *
 * تُشارك بين الباكند (NestJS validation pipes) والفرونت (RHF + zodResolver).
 *
 * المرجع: docs/06-modules.md (المبيعات) و prisma/schema.prisma.
 *
 * قواعد محاسبية مقفلة (LOCKED):
 *   • QUICK     → مبلغ إجمالي فقط، بدون عناصر، بدون عميل. نقدي.
 *   • DETAILED  → نقدي، يُسمح بإضافة عناصر تفصيلية (اختياري).
 *   • CREDIT    → عميل مطلوب + فحص ائتمان + ذرّياً CustomerTransaction(DEBT)
 *                  + زيادة Customer.currentBalance.
 *
 *  QUICK/DETAILED  → daily_income.cash_sales += totalAmount
 *  CREDIT          → daily_income.credit_sales += totalAmount  (إعلامي فقط)
 */

import { z } from 'zod';
import { cuidSchema, decimalSchema, paginationSchema } from './common';

// ─── Enums (from Prisma) ────────────────────────────────────
export const saleModeEnum = z.enum(['QUICK', 'DETAILED', 'CREDIT']);
export type SaleModeZ = z.infer<typeof saleModeEnum>;

// ─── Item line ───────────────────────────────────────────────
export const saleItemSchema = z
  .object({
    name: z.string().trim().min(1, 'اسم المنتج مطلوب').max(200),
    quantity: decimalSchema({}),
    unitPrice: decimalSchema({ allowZero: true }),
  })
  .transform((v) => ({
    ...v,
    totalPrice: Number((v.quantity * v.unitPrice).toFixed(2)),
  }));
export type SaleItemInput = z.infer<typeof saleItemSchema>;

// ─── Create sale ─────────────────────────────────────────────
export const createSaleSchema = z
  .object({
    mode: saleModeEnum,
    customerId: cuidSchema.optional(),
    totalAmount: decimalSchema({}),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(saleItemSchema).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    // CREDIT requires customer
    if (val.mode === 'CREDIT' && !val.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerId'],
        message: 'العميل مطلوب للبيع الآجل',
      });
    }
    // QUICK forbids items
    if (val.mode === 'QUICK' && val.items && val.items.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'البيع السريع لا يقبل عناصر تفصيلية — استخدم DETAILED',
      });
    }
    // If items provided, totals must match (±0.01)
    if (val.items && val.items.length > 0) {
      const sum = val.items.reduce((acc, it) => acc + it.totalPrice, 0);
      const rounded = Number(sum.toFixed(2));
      if (Math.abs(rounded - val.totalAmount) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalAmount'],
          message: `إجمالي العناصر (${rounded}) لا يطابق إجمالي الفاتورة (${val.totalAmount})`,
        });
      }
    }
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// ─── List ────────────────────────────────────────────────────
export const listSalesQuerySchema = paginationSchema.extend({
  customerId: cuidSchema.optional(),
  mode: saleModeEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeCancelled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

// ─── Cancel ──────────────────────────────────────────────────
export const cancelSaleSchema = z.object({
  reason: z.string().trim().min(1, 'يجب ذكر السبب').max(500),
});
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

export const saleIdParamSchema = z.object({ id: cuidSchema });
