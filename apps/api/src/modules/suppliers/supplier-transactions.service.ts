/**
 * SupplierTransactionsService — Phase 4 P4-2.
 *
 * Append-only ledger mirroring CustomerTransactionsService:
 *   • Every PAYMENT / ADJUSTMENT / CREDIT_PURCHASE mutates Supplier.currentBalance
 *     INSIDE the same `prisma.$transaction` that creates the ledger row.
 *   • `balanceBefore` / `balanceAfter` snapshots captured atomically.
 *   • Cancellation is soft (original row preserved) — a *reverse* effect is
 *     applied to Supplier.currentBalance, again inside a transaction.
 *
 * Sign convention (LOCKED):
 *   currentBalance > 0 → store owes the supplier
 *   PAYMENT     amount → balance decreases (we paid them)
 *   CREDIT_PURCHASE   → balance increases (we owe more)
 *   ADJUSTMENT signed → balance += signed amount
 *
 * Note: `CREDIT_PURCHASE` rows are NOT created via this service — they are
 * created by `PurchasesService.createCreditPurchase` to keep the atomic
 * three-step write (purchase + tx + balance) in one place. This service
 * exposes PAYMENT, ADJUSTMENT, list, and cancel.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CancelSupplierTransactionInput,
  CreateSupplierAdjustmentInput,
  CreateSupplierPaymentInput,
  ListSupplierTransactionsQuery,
} from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface TxScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SupplierTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List per supplier ────────────────────────────────────
  async list(scope: TxScope, supplierId: string, query: ListSupplierTransactionsQuery) {
    await this.assertSupplier(scope, supplierId);
    const { page, limit, type, includeCancelled, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      supplierId,
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplierTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.supplierTransaction.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Create PAYMENT (atomic — money out of store) ─────────
  async createPayment(scope: TxScope, supplierId: string, input: CreateSupplierPaymentInput) {
    const supplier = await this.assertSupplier(scope, supplierId);
    if (!supplier.isActive) {
      throw new ConflictException({
        message: 'المورّد غير نشط',
        code: 'SUPPLIER_INACTIVE',
      });
    }
    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new BadRequestException({
        message: 'المبلغ يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }
    const before = Number(supplier.currentBalance);
    const after = before - amount;

    const created = await this.prisma.$transaction(async (db) => {
      const row = await db.supplierTransaction.create({
        data: {
          supplierId,
          type: 'PAYMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await db.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: after },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'supplier_transaction',
          entityId: row.id,
          newValues: { type: 'PAYMENT', amount, balanceAfter: after },
        },
      });
      return row;
    });
    return created;
  }

  // ─── Create ADJUSTMENT (signed) ───────────────────────────
  async createAdjustment(scope: TxScope, supplierId: string, input: CreateSupplierAdjustmentInput) {
    const supplier = await this.assertSupplier(scope, supplierId);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException({
        message: 'مبلغ التسوية يجب ألا يكون صفراً',
        code: 'INVALID_AMOUNT',
      });
    }
    const before = Number(supplier.currentBalance);
    const after = before + amount; // can be positive or negative

    const created = await this.prisma.$transaction(async (db) => {
      const row = await db.supplierTransaction.create({
        data: {
          supplierId,
          type: 'ADJUSTMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes,
          createdById: scope.actorId,
        },
      });
      await db.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: after },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'supplier_transaction',
          entityId: row.id,
          newValues: { type: 'ADJUSTMENT', amount, balanceAfter: after, reason: input.notes },
        },
      });
      return row;
    });
    return created;
  }

  // ─── Cancel (reverse balance, soft-mark row) ──────────────
  async cancel(
    scope: TxScope,
    supplierId: string,
    txId: string,
    input: CancelSupplierTransactionInput,
  ) {
    await this.assertSupplier(scope, supplierId);
    const original = await this.prisma.supplierTransaction.findFirst({
      where: { id: txId, supplierId },
    });
    if (!original) {
      throw new NotFoundException({
        message: 'الحركة غير موجودة',
        code: 'TX_NOT_FOUND',
      });
    }
    if (original.cancelledAt) {
      throw new ConflictException({
        message: 'الحركة ملغاة مسبقاً',
        code: 'TX_ALREADY_CANCELLED',
      });
    }
    if (original.type === 'OPENING') {
      throw new ConflictException({
        message: 'لا يمكن إلغاء الرصيد الافتتاحي',
        code: 'TX_OPENING_PROTECTED',
      });
    }
    if (original.type === 'CREDIT_PURCHASE') {
      throw new ConflictException({
        message: 'لإلغاء عملية شراء آجلة، استخدم نقطة نهاية إلغاء عملية الشراء',
        code: 'TX_CREDIT_PURCHASE_USE_PURCHASE_CANCEL',
      });
    }

    // Reverse delta:
    // - PAYMENT     subtracted amount  → cancel adds amount
    // - ADJUSTMENT  added signed amount → cancel subtracts signed amount
    const reverseDelta =
      original.type === 'PAYMENT' ? Number(original.amount) : -Number(original.amount);

    const result = await this.prisma.$transaction(async (db) => {
      const supplier = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
      const newBalance = Number(supplier.currentBalance) + reverseDelta;
      const updated = await db.supplierTransaction.update({
        where: { id: txId },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });
      await db.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: newBalance },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'supplier_transaction',
          entityId: txId,
          oldValues: {
            type: original.type,
            amount: original.amount,
            balanceAfter: original.balanceAfter,
          },
          newValues: { newBalance, reason: input.reason },
        },
      });
      return { ...updated, newBalance };
    });
    return result;
  }

  // ─── Helpers ──────────────────────────────────────────────
  private async assertSupplier(scope: TxScope, supplierId: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id: supplierId, storeId: scope.storeId, deletedAt: null },
    });
    if (!s) {
      throw new NotFoundException({
        message: 'المورّد غير موجود',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return s;
  }
}
