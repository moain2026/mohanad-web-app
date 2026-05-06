/**
 * Suppliers + Supplier Transactions schemas (Phase 4).
 *
 * تُشارك بين الباكند (NestJS validation pipes) والفرونت (RHF + zodResolver).
 *
 * المرجع: docs/06-modules.md (الموردون) و prisma/schema.prisma.
 *
 * ملاحظات تصميمية:
 *   • currentBalance > 0 → نحن مدينون للمورّد (نلتزم بدفعه).
 *   • currentBalance = 0 → الحساب مسوّى.
 *   • currentBalance < 0 → دفعنا أكثر من اللازم (المورد يدين لنا).
 */

import { z } from 'zod';
import {
  arabicNameSchema,
  cuidSchema,
  decimalSchema,
  paginationSchema,
  phoneSchema,
} from './common';

// ─── Enums (from Prisma) ────────────────────────────────────
export const supplierTransactionTypeEnum = z.enum([
  'OPENING',
  'CREDIT_PURCHASE',
  'PAYMENT',
  'ADJUSTMENT',
]);
export type SupplierTransactionTypeZ = z.infer<typeof supplierTransactionTypeEnum>;

// ─── Create supplier ─────────────────────────────────────────
export const createSupplierSchema = z.object({
  name: arabicNameSchema,
  phone: phoneSchema,
  whatsappPhone: phoneSchema,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  openingBalance: decimalSchema({ allowZero: true }).default(0),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

// ─── Update supplier ─────────────────────────────────────────
export const updateSupplierSchema = z.object({
  name: arabicNameSchema.optional(),
  phone: phoneSchema,
  whatsappPhone: phoneSchema,
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// ─── List query ──────────────────────────────────────────────
export const listSuppliersQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  hasBalance: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
});
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

// ─── Supplier transactions ───────────────────────────────────
/**
 * Record a payment to a supplier (decreases balance — money out of the store).
 */
export const createSupplierPaymentSchema = z.object({
  amount: decimalSchema({}),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

/**
 * Manual adjustment — owner-only. Signed amount (positive = increase debt to
 * supplier, negative = decrease).
 */
export const createSupplierAdjustmentSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((n) => Number.isFinite(n) && n !== 0, 'يجب أن يكون مبلغاً غير صفر'),
  notes: z.string().trim().min(1, 'يجب توضيح سبب التسوية').max(1000),
});
export type CreateSupplierAdjustmentInput = z.infer<typeof createSupplierAdjustmentSchema>;

export const cancelSupplierTransactionSchema = z.object({
  reason: z.string().trim().min(1, 'يجب ذكر السبب').max(500),
});
export type CancelSupplierTransactionInput = z.infer<typeof cancelSupplierTransactionSchema>;

export const listSupplierTransactionsQuerySchema = paginationSchema.extend({
  type: supplierTransactionTypeEnum.optional(),
  includeCancelled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListSupplierTransactionsQuery = z.infer<typeof listSupplierTransactionsQuerySchema>;

// ─── supplierId param helper ─────────────────────────────────
export const supplierIdParamSchema = z.object({ id: cuidSchema });
