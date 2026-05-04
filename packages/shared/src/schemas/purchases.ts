/**
 * Purchases + Purchase Items schemas (Phase 4).
 *
 * تُشارك بين الباكند (NestJS validation pipes) والفرونت (RHF + zodResolver).
 *
 * المرجع: docs/06-modules.md (المشتريات) و prisma/schema.prisma.
 *
 * قاعدة محاسبية مقفلة (LOCKED — راجع docs/12-agent-memory.md):
 *   • CASH purchase → سجل عملية الشراء فقط، لا يتغير رصيد المورّد.
 *   • CREDIT purchase → ذرّياً: Purchase + SupplierTransaction(CREDIT_PURCHASE)
 *     + زيادة Supplier.currentBalance بقيمة totalAmount.
 */

import { z } from 'zod';
import { cuidSchema, decimalSchema, paginationSchema } from './common';

// ─── Enums (from Prisma) ────────────────────────────────────
export const purchasePaymentTypeEnum = z.enum(['CASH', 'CREDIT']);
export type PurchasePaymentTypeZ = z.infer<typeof purchasePaymentTypeEnum>;

// ─── Item line ───────────────────────────────────────────────
/**
 * عنصر تفصيلي لعملية شراء. اسم حر (نصّي) في Phase 4 — `productId` يبقى null
 * حتى Phase 9 (المخزون).
 */
export const purchaseItemSchema = z
  .object({
    name: z.string().trim().min(1, 'اسم المنتج مطلوب').max(200),
    quantity: decimalSchema({}),
    unitCost: decimalSchema({ allowZero: true }),
  })
  .transform((v) => ({
    ...v,
    totalCost: Number((v.quantity * v.unitCost).toFixed(2)),
  }));
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;

// ─── Create purchase ─────────────────────────────────────────
/**
 * Body مشترك لإنشاء عملية شراء (نقد أو آجل).
 *
 * - إذا تم تمرير `items`، يُحتسب `totalAmount` من مجموع `totalCost`؛ يجب أن
 *   يساوي القيمة المُمرَّرة (إن وُجدت) — وإلا يُرفض الطلب.
 * - إذا لم تُمرَّر `items`، يُسجَّل المبلغ الإجمالي كـ "إجمالي فقط" بدون تفاصيل.
 */
export const createPurchaseSchema = z
  .object({
    supplierId: cuidSchema,
    paymentType: purchasePaymentTypeEnum,
    totalAmount: decimalSchema({}),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(purchaseItemSchema).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.items && val.items.length > 0) {
      const sum = val.items.reduce((acc, it) => acc + it.totalCost, 0);
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
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

// ─── List query ──────────────────────────────────────────────
export const listPurchasesQuerySchema = paginationSchema.extend({
  supplierId: cuidSchema.optional(),
  paymentType: purchasePaymentTypeEnum.optional(),
  includeCancelled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;

// ─── Cancel purchase ─────────────────────────────────────────
export const cancelPurchaseSchema = z.object({
  reason: z.string().trim().min(1, 'يجب ذكر السبب').max(500),
});
export type CancelPurchaseInput = z.infer<typeof cancelPurchaseSchema>;

// ─── purchaseId param helper ─────────────────────────────────
export const purchaseIdParamSchema = z.object({ id: cuidSchema });
