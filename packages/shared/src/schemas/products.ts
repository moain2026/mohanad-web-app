/**
 * Products & Stock Movements — Zod schemas for Phase 9 (Inventory).
 */

import { z } from 'zod';

import { decimalSchema, paginationSchema } from './common';

export const productUnitSchema = z.enum(['piece', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'carton']);

export const createProductSchema = z.object({
  sku: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1).max(120),
  unit: productUnitSchema.default('piece'),
  category: z.string().trim().max(60).optional().nullable(),
  reorderLevel: decimalSchema({ allowZero: true }).default(0),
  costPrice: decimalSchema({ allowZero: true }).default(0),
  sellPrice: decimalSchema({ allowZero: true }).default(0),
  openingStock: decimalSchema({ allowZero: true }).default(0),
});

export const updateProductSchema = createProductSchema.partial().omit({ openingStock: true });

export const listProductsQuerySchema = paginationSchema.extend({
  category: z.string().trim().max(60).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

// ─── Stock Movements ────────────────────────────────────
export const stockMovementTypeSchema = z.enum(['IN', 'OUT', 'ADJUST']);

export const createStockMovementSchema = z.object({
  productId: z.string().min(1),
  type: stockMovementTypeSchema,
  // For ADJUST this is the **signed delta**. For IN/OUT it is positive.
  quantity: decimalSchema(),
  notes: z.string().trim().max(400).optional(),
});

export const listStockMovementsQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  type: stockMovementTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeCancelled: z.coerce.boolean().optional(),
});

export const cancelStockMovementSchema = z.object({
  reason: z.string().trim().min(1).max(400),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>;
export type CancelStockMovementInput = z.infer<typeof cancelStockMovementSchema>;
