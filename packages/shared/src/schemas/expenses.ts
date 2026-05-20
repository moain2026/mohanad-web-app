/**
 * Expenses + Expense Categories schemas (Phase 5).
 *
 * تُشارك بين الباكند (NestJS validation pipes) والفرونت (RHF + zodResolver).
 *
 * المرجع: docs/06-modules.md (المصروفات) و prisma/schema.prisma.
 *
 * قواعد محاسبية مقفلة (LOCKED — راجع docs/12-agent-memory.md):
 *   • NORMAL              → مصروف عادي. يُؤثّر على daily_income.normal_expenses.
 *   • SUPPLIER_PAYMENT    → ذرّياً: Expense + SupplierTransaction(PAYMENT)
 *                            + تخفيض Supplier.currentBalance بقيمة amount.
 *                            يُؤثّر على daily_income.supplier_payments.
 *   • CASH_PURCHASE_LINK  → يربط مصروفاً بـ purchases.id موجود (نقدي).
 *                            لا تأثير مالي إضافي — Purchase هي السجل المرجعي.
 *                            daily_income.cash_purchases يُقرأ من purchases
 *                            (لتفادي العدّ المُكرَّر).
 */

import { z } from 'zod';
import { cuidSchema, decimalSchema, paginationSchema } from './common';

// ─── Enums (from Prisma) ────────────────────────────────────
export const expenseTypeEnum = z.enum(['NORMAL', 'SUPPLIER_PAYMENT', 'CASH_PURCHASE_LINK']);
export type ExpenseTypeZ = z.infer<typeof expenseTypeEnum>;

// ═══════════════════════════════════════════════════════════
//  EXPENSE CATEGORIES
// ═══════════════════════════════════════════════════════════

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'اسم الفئة مطلوب').max(120),
  description: z.string().trim().max(500).optional(),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = createExpenseCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const listExpenseCategoriesQuerySchema = paginationSchema.extend({
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListExpenseCategoriesQuery = z.infer<typeof listExpenseCategoriesQuerySchema>;

// ═══════════════════════════════════════════════════════════
//  EXPENSES
// ═══════════════════════════════════════════════════════════

/**
 * Body لإنشاء مصروف. الحقول `supplierId` و `purchaseId` مطلوبة فقط
 * للأنواع الخاصة.
 *
 * - NORMAL                → categoryId + amount + description
 * - SUPPLIER_PAYMENT      → supplierId مطلوب. يُنشئ SupplierTransaction.
 * - CASH_PURCHASE_LINK    → purchaseId مطلوب. لا تأثير مالي.
 */
export const createExpenseSchema = z
  .object({
    type: expenseTypeEnum,
    categoryId: cuidSchema,
    amount: decimalSchema({}),
    description: z.string().trim().min(1, 'الوصف مطلوب').max(500),
    expenseDate: z.coerce.date().optional(),
    supplierId: cuidSchema.optional(),
    purchaseId: cuidSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'SUPPLIER_PAYMENT' && !val.supplierId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplierId'],
        message: 'المورّد مطلوب لمدفوعات الموردين',
      });
    }
    if (val.type === 'CASH_PURCHASE_LINK' && !val.purchaseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['purchaseId'],
        message: 'عملية الشراء مطلوبة لربط الفاتورة',
      });
    }
    if (val.type === 'NORMAL' && (val.supplierId || val.purchaseId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'المصروف العادي لا يقبل supplierId أو purchaseId',
      });
    }
  });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const listExpensesQuerySchema = paginationSchema.extend({
  categoryId: cuidSchema.optional(),
  type: expenseTypeEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeCancelled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

export const cancelExpenseSchema = z.object({
  reason: z.string().trim().min(1, 'يجب ذكر السبب').max(500),
});
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;

export const expenseIdParamSchema = z.object({ id: cuidSchema });
export const expenseCategoryIdParamSchema = z.object({ id: cuidSchema });
