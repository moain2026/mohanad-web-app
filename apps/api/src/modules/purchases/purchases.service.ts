/**
 * PurchasesService — Phase 4 P4-3.
 *
 * The accounting rule LOCKED in docs/12-agent-memory.md:
 *
 *   ┌─────────────┬────────────────────────────────────────────────────┐
 *   │ paymentType │ Effect                                             │
 *   ├─────────────┼────────────────────────────────────────────────────┤
 *   │ CASH        │ Create Purchase row only.                          │
 *   │             │ NO SupplierTransaction.                            │
 *   │             │ NO change to Supplier.currentBalance.              │
 *   │ CREDIT      │ Atomic, single $transaction:                       │
 *   │             │   1. Create Purchase row.                          │
 *   │             │   2. Create SupplierTransaction(CREDIT_PURCHASE)   │
 *   │             │      with referenceType='purchase', referenceId.   │
 *   │             │   3. Increase Supplier.currentBalance by total.    │
 *   └─────────────┴────────────────────────────────────────────────────┘
 *
 * Cancellation:
 *   • Cancelling a CASH purchase soft-marks the row, no balance change.
 *   • Cancelling a CREDIT purchase atomically:
 *       1. Soft-marks the Purchase row (cancelledAt, cancelReason).
 *       2. Soft-marks the matching SupplierTransaction(CREDIT_PURCHASE) row.
 *       3. Decreases Supplier.currentBalance by the original totalAmount.
 *   • A previously cancelled purchase cannot be cancelled again.
 *
 * Items (`PurchaseItem`):
 *   • Optional in Phase 4. When provided, sum(totalCost) MUST equal
 *     totalAmount (already enforced by Zod via createPurchaseSchema).
 *   • `productId` is reserved for Phase 9 (Inventory) — kept null here.
 *   • `hasItems` is denormalised on Purchase for cheap list rendering.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CancelPurchaseInput, CreatePurchaseInput, ListPurchasesQuery } from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface PurchaseScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List (paginated + filters) ───────────────────────────
  async list(scope: PurchaseScope, query: ListPurchasesQuery) {
    const { page, limit, sortDir, supplierId, paymentType, includeCancelled, from, to } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(supplierId ? { supplierId } : {}),
      ...(paymentType ? { paymentType } : {}),
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
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Detail (with items) ──────────────────────────────────
  async findOne(scope: PurchaseScope, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!purchase) {
      throw new NotFoundException({
        message: 'عملية الشراء غير موجودة',
        code: 'PURCHASE_NOT_FOUND',
      });
    }
    return purchase;
  }

  // ─── Create (cash or credit — single entry point) ─────────
  async create(scope: PurchaseScope, input: CreatePurchaseInput) {
    // 1. Validate the supplier (must exist, in same store, not soft-deleted).
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, storeId: scope.storeId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException({
        message: 'المورّد غير موجود',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    // 2. Credit purchase requires the supplier to be active.
    if (input.paymentType === 'CREDIT' && !supplier.isActive) {
      throw new ConflictException({
        message: 'لا يمكن تسجيل شراء آجل لمورّد غير نشط',
        code: 'SUPPLIER_INACTIVE',
      });
    }
    const total = Number(input.totalAmount);
    if (total <= 0) {
      throw new BadRequestException({
        message: 'إجمالي الفاتورة يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }

    // 3. Atomic write — covers both branches in one $transaction.
    const created = await this.prisma.$transaction(async (db) => {
      // a) Create the Purchase row.
      const purchase = await db.purchase.create({
        data: {
          storeId: scope.storeId,
          supplierId: input.supplierId,
          paymentType: input.paymentType,
          totalAmount: total,
          notes: input.notes ?? null,
          hasItems: !!(input.items && input.items.length > 0),
          createdById: scope.actorId,
        },
      });

      // b) Persist optional items.
      if (input.items && input.items.length > 0) {
        await db.purchaseItem.createMany({
          data: input.items.map((it) => ({
            purchaseId: purchase.id,
            productId: null, // Phase 9 — not yet linked
            name: it.name,
            quantity: it.quantity,
            unitCost: it.unitCost,
            totalCost: it.totalCost,
          })),
        });
      }

      // c) For CREDIT only: ledger row + balance update.
      if (input.paymentType === 'CREDIT') {
        const before = Number(supplier.currentBalance);
        const after = before + total;
        await db.supplierTransaction.create({
          data: {
            supplierId: input.supplierId,
            type: 'CREDIT_PURCHASE',
            amount: total,
            balanceBefore: before,
            balanceAfter: after,
            referenceType: 'purchase',
            referenceId: purchase.id,
            createdById: scope.actorId,
            notes: input.notes ?? null,
          },
        });
        await db.supplier.update({
          where: { id: input.supplierId },
          data: { currentBalance: after },
        });
      }

      // d) Audit log.
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'purchase',
          entityId: purchase.id,
          newValues: {
            supplierId: input.supplierId,
            paymentType: input.paymentType,
            totalAmount: total,
            hasItems: purchase.hasItems,
          },
        },
      });

      return purchase;
    });

    return this.findOne(scope, created.id);
  }

  // ─── Cancel (atomic balance reversal for CREDIT) ──────────
  async cancel(scope: PurchaseScope, id: string, input: CancelPurchaseInput) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!purchase) {
      throw new NotFoundException({
        message: 'عملية الشراء غير موجودة',
        code: 'PURCHASE_NOT_FOUND',
      });
    }
    if (purchase.cancelledAt) {
      throw new ConflictException({
        message: 'عملية الشراء ملغاة مسبقاً',
        code: 'PURCHASE_ALREADY_CANCELLED',
      });
    }

    const result = await this.prisma.$transaction(async (db) => {
      // a) Soft-mark the Purchase row.
      const updated = await db.purchase.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });

      // b) For CREDIT: reverse the supplier balance + soft-mark the matching tx.
      if (purchase.paymentType === 'CREDIT') {
        const linkedTx = await db.supplierTransaction.findFirst({
          where: {
            supplierId: purchase.supplierId,
            referenceType: 'purchase',
            referenceId: purchase.id,
            type: 'CREDIT_PURCHASE',
            cancelledAt: null,
          },
        });
        if (linkedTx) {
          await db.supplierTransaction.update({
            where: { id: linkedTx.id },
            data: {
              cancelledAt: new Date(),
              cancelledById: scope.actorId,
              cancelReason: input.reason,
            },
          });
        }
        const supplier = await db.supplier.findUniqueOrThrow({
          where: { id: purchase.supplierId },
        });
        const newBalance = Number(supplier.currentBalance) - Number(purchase.totalAmount);
        await db.supplier.update({
          where: { id: purchase.supplierId },
          data: { currentBalance: newBalance },
        });
      }

      // c) Audit log.
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'purchase',
          entityId: id,
          oldValues: {
            paymentType: purchase.paymentType,
            totalAmount: purchase.totalAmount,
          },
          newValues: { reason: input.reason },
        },
      });

      return updated;
    });

    return result;
  }
}
