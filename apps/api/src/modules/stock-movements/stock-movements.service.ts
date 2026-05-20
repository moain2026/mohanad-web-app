/**
 * StockMovementsService — Phase 9 P9-2.
 *
 * Append-only ledger of stock changes. Every mutation updates
 * Product.currentStock atomically in the same transaction.
 *
 *   IN     → +quantity. Used for purchases, returns, manual additions.
 *   OUT    → −quantity. Used for sales, write-offs.
 *   ADJUST → signed delta. Used for stocktake corrections.
 *
 * For ADJUST the `quantity` is the **signed delta** (positive or negative).
 * For IN/OUT it is always positive (the type carries the sign).
 *
 * Cancellation reverses the stock change atomically — never deletes a row.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CancelStockMovementInput,
  CreateStockMovementInput,
  ListStockMovementsQuery,
} from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ─────────────────────────────────────────────────
  async list(scope: Scope, query: ListStockMovementsQuery) {
    const { page, limit, sortDir, productId, type, from, to, includeCancelled } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(scope: Scope, id: string) {
    const m = await this.prisma.stockMovement.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        product: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!m) {
      throw new NotFoundException({
        message: 'حركة مخزون غير موجودة',
        code: 'STOCK_MOVEMENT_NOT_FOUND',
      });
    }
    return m;
  }

  // ─── Create (manual movement) ────────────────────────────
  async create(scope: Scope, input: CreateStockMovementInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, storeId: scope.storeId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'المنتج غير موجود',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    if (!product.isActive) {
      throw new ConflictException({
        message: 'المنتج غير نشط',
        code: 'PRODUCT_INACTIVE',
      });
    }

    const rawQty = Number(input.quantity);
    if (!Number.isFinite(rawQty) || rawQty === 0) {
      throw new BadRequestException({
        message: 'الكمية يجب أن تكون مختلفة عن الصفر',
        code: 'INVALID_QUANTITY',
      });
    }

    // For IN / OUT the quantity must be positive; for ADJUST it can be signed.
    if ((input.type === 'IN' || input.type === 'OUT') && rawQty <= 0) {
      throw new BadRequestException({
        message: 'الكمية يجب أن تكون موجبة لـ IN / OUT',
        code: 'INVALID_QUANTITY_SIGN',
      });
    }

    return this.applyMovement(scope, {
      productId: product.id,
      type: input.type,
      quantity: rawQty,
      notes: input.notes,
      referenceType: 'manual',
      referenceId: null,
    });
  }

  /**
   * Internal: atomic apply of a stock movement.
   * Used by `create()` AND by Sale / Purchase hooks (when inventory is on).
   */
  async applyMovement(
    scope: Scope,
    args: {
      productId: string;
      type: 'IN' | 'OUT' | 'ADJUST';
      quantity: number;
      notes?: string;
      referenceType?: string | null;
      referenceId?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (db) => {
      const p = await db.product.findUniqueOrThrow({ where: { id: args.productId } });
      const before = Number(p.currentStock);
      let delta = args.quantity;
      if (args.type === 'OUT') delta = -Math.abs(args.quantity);
      else if (args.type === 'IN') delta = Math.abs(args.quantity);
      const after = before + delta;

      if (after < 0) {
        throw new ConflictException({
          message: `المخزون غير كافٍ (متاح ${before})`,
          code: 'INSUFFICIENT_STOCK',
        });
      }

      const movement = await db.stockMovement.create({
        data: {
          storeId: scope.storeId,
          productId: args.productId,
          type: args.type,
          quantity: args.quantity,
          stockBefore: before,
          stockAfter: after,
          notes: args.notes ?? null,
          referenceType: args.referenceType ?? null,
          referenceId: args.referenceId ?? null,
          createdById: scope.actorId,
        },
      });
      await db.product.update({
        where: { id: args.productId },
        data: { currentStock: after },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'stock_movement',
        entityId: movement.id,
        newValues: {
          productId: args.productId,
          type: args.type,
          quantity: args.quantity,
          stockBefore: before,
          stockAfter: after,
        },
      });
      return movement;
    });
  }

  // ─── Cancel ──────────────────────────────────────────────
  async cancel(scope: Scope, id: string, input: CancelStockMovementInput) {
    const m = await this.findOne(scope, id);
    if (m.cancelledAt) {
      throw new ConflictException({
        message: 'تم إلغاء الحركة مسبقاً',
        code: 'STOCK_MOVEMENT_ALREADY_CANCELLED',
      });
    }

    return this.prisma.$transaction(async (db) => {
      const product = await db.product.findUniqueOrThrow({
        where: { id: m.productId },
      });
      const currentStock = Number(product.currentStock);
      // Reverse the delta.
      let reverseDelta = 0;
      if (m.type === 'IN') reverseDelta = -Number(m.quantity);
      else if (m.type === 'OUT') reverseDelta = Number(m.quantity);
      else reverseDelta = -Number(m.quantity); // ADJUST: subtract signed delta

      const newStock = currentStock + reverseDelta;
      if (newStock < 0) {
        throw new ConflictException({
          message: 'لا يمكن الإلغاء — سيؤدي إلى مخزون سالب',
          code: 'CANCEL_WOULD_CAUSE_NEGATIVE_STOCK',
        });
      }
      await db.product.update({
        where: { id: m.productId },
        data: { currentStock: newStock },
      });
      const updated = await db.stockMovement.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'cancel',
        entityType: 'stock_movement',
        entityId: id,
        oldValues: { quantity: String(m.quantity), type: m.type },
        newValues: { reason: input.reason },
      });
      return updated;
    });
  }
}
