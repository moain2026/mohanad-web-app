/**
 * ExpensesService — Phase 5 P5-2.
 *
 * The Phase-5 accounting rules LOCKED in docs/12-agent-memory.md:
 *
 *   ┌────────────────────────────┬─────────────────────────────────────────────┐
 *   │ ExpenseType                │ Effect                                      │
 *   ├────────────────────────────┼─────────────────────────────────────────────┤
 *   │ NORMAL                     │ Insert Expense row only.                    │
 *   │                            │ daily_income.normal_expenses ↑ amount.      │
 *   │ SUPPLIER_PAYMENT           │ Atomic single $transaction:                 │
 *   │                            │   1. Insert Expense row.                    │
 *   │                            │   2. Insert SupplierTransaction(PAYMENT)    │
 *   │                            │      with referenceType='expense',          │
 *   │                            │      referenceId=expense.id.                │
 *   │                            │   3. Decrement Supplier.currentBalance.     │
 *   │                            │   4. Cross-link the expense back via        │
 *   │                            │      referenceType='supplier_transaction'.  │
 *   │                            │   daily_income.supplier_payments ↑ amount.  │
 *   │ CASH_PURCHASE_LINK         │ Insert Expense row referencing existing     │
 *   │                            │ purchases.id (referenceType='purchase').    │
 *   │                            │ NO additional financial side-effects —      │
 *   │                            │ purchases is the authoritative ledger.      │
 *   │                            │ daily_income.cash_purchases is recomputed   │
 *   │                            │ from `purchases`, NOT from this row, to     │
 *   │                            │ avoid double-counting.                      │
 *   └────────────────────────────┴─────────────────────────────────────────────┘
 *
 * Cancellation:
 *   • NORMAL                → soft-mark only.
 *   • SUPPLIER_PAYMENT      → atomically soft-mark expense + linked supplier
 *                              transaction + add amount back to the supplier
 *                              currentBalance.
 *   • CASH_PURCHASE_LINK    → soft-mark only (the underlying Purchase still
 *                              exists; cancelling that is a separate flow).
 *
 * Daily-income recompute is fire-and-forget at the end of each mutation —
 * see DailyIncomeService.recompute().
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';

import type { CancelExpenseInput, CreateExpenseInput, ListExpensesQuery } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { DailyIncomeService } from '../daily-income/daily-income.service';
import { PrismaService } from '../prisma/prisma.service';

interface ExpenseScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DailyIncomeService))
    private readonly dailyIncome: DailyIncomeService,
  ) {}

  // ─── List ─────────────────────────────────────────────────
  async list(scope: ExpenseScope, query: ListExpensesQuery) {
    const { page, limit, sortDir, categoryId, type, from, to, includeCancelled } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(categoryId ? { categoryId } : {}),
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(from || to
        ? {
            expenseDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Detail ───────────────────────────────────────────────
  async findOne(scope: ExpenseScope, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!expense) {
      throw new NotFoundException({
        message: 'المصروف غير موجود',
        code: 'EXPENSE_NOT_FOUND',
      });
    }
    return expense;
  }

  // ─── Create (3 paths) ─────────────────────────────────────
  async create(scope: ExpenseScope, input: CreateExpenseInput) {
    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new BadRequestException({
        message: 'مبلغ المصروف يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }

    // Validate category (in same store, not soft-deleted, active).
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, storeId: scope.storeId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException({
        message: 'فئة المصروف غير موجودة',
        code: 'EXPENSE_CATEGORY_NOT_FOUND',
      });
    }
    if (!category.isActive) {
      throw new ConflictException({
        message: 'لا يمكن استخدام فئة غير نشطة',
        code: 'EXPENSE_CATEGORY_INACTIVE',
      });
    }

    // Type-specific validation (cheaper to fail-fast outside the tx).
    let supplier = null as Awaited<ReturnType<typeof this.prisma.supplier.findFirst>> | null;
    let purchase = null as Awaited<ReturnType<typeof this.prisma.purchase.findFirst>> | null;

    if (input.type === 'SUPPLIER_PAYMENT') {
      supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId!, storeId: scope.storeId, deletedAt: null },
      });
      if (!supplier) {
        throw new NotFoundException({
          message: 'المورّد غير موجود',
          code: 'SUPPLIER_NOT_FOUND',
        });
      }
    }

    if (input.type === 'CASH_PURCHASE_LINK') {
      purchase = await this.prisma.purchase.findFirst({
        where: { id: input.purchaseId!, storeId: scope.storeId },
      });
      if (!purchase) {
        throw new NotFoundException({
          message: 'عملية الشراء غير موجودة',
          code: 'PURCHASE_NOT_FOUND',
        });
      }
      if (purchase.paymentType !== 'CASH') {
        throw new ConflictException({
          message: 'الربط متاح لعمليات الشراء النقدية فقط',
          code: 'PURCHASE_NOT_CASH',
        });
      }
      if (purchase.cancelledAt) {
        throw new ConflictException({
          message: 'لا يمكن ربط مصروف بعملية شراء ملغاة',
          code: 'PURCHASE_CANCELLED',
        });
      }
    }

    const expenseDate = input.expenseDate ?? new Date();

    const created = await this.prisma.$transaction(async (db) => {
      // a) Insert the Expense row (referenceType/referenceId filled per type).
      const referenceType =
        input.type === 'SUPPLIER_PAYMENT'
          ? 'supplier_transaction'
          : input.type === 'CASH_PURCHASE_LINK'
            ? 'purchase'
            : null;

      // For CASH_PURCHASE_LINK we already know the reference id (purchase.id).
      // For SUPPLIER_PAYMENT we fill it AFTER creating the supplier tx below.
      const initialReferenceId = input.type === 'CASH_PURCHASE_LINK' ? input.purchaseId! : null;

      const expense = await db.expense.create({
        data: {
          storeId: scope.storeId,
          categoryId: input.categoryId,
          type: input.type,
          amount,
          description: input.description,
          expenseDate,
          referenceType,
          referenceId: initialReferenceId,
          createdById: scope.actorId,
        },
      });

      // b) SUPPLIER_PAYMENT — atomic ledger + balance update.
      if (input.type === 'SUPPLIER_PAYMENT' && supplier) {
        const before = Number(supplier.currentBalance);
        const after = before - amount;
        const supplierTx = await db.supplierTransaction.create({
          data: {
            supplierId: input.supplierId!,
            type: 'PAYMENT',
            amount,
            balanceBefore: before,
            balanceAfter: after,
            referenceType: 'expense',
            referenceId: expense.id,
            createdById: scope.actorId,
            notes: input.description,
          },
        });
        await db.supplier.update({
          where: { id: input.supplierId! },
          data: { currentBalance: after },
        });
        // Cross-link the expense back to the supplier transaction so reports
        // can navigate either direction.
        await db.expense.update({
          where: { id: expense.id },
          data: { referenceId: supplierTx.id },
        });
      }

      // c) Audit log.
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'expense',
        entityId: expense.id,
        newValues: {
          type: input.type,
          amount,
          categoryId: input.categoryId,
          supplierId: input.supplierId ?? null,
          purchaseId: input.purchaseId ?? null,
        },
      });

      return expense;
    });

    // d) Fire-and-forget daily-income recompute (own transaction).
    await this.dailyIncome.recompute(scope.storeId, expenseDate);

    return this.findOne(scope, created.id);
  }

  // ─── Cancel ───────────────────────────────────────────────
  async cancel(scope: ExpenseScope, id: string, input: CancelExpenseInput) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!expense) {
      throw new NotFoundException({
        message: 'المصروف غير موجود',
        code: 'EXPENSE_NOT_FOUND',
      });
    }
    if (expense.cancelledAt) {
      throw new ConflictException({
        message: 'المصروف ملغى مسبقاً',
        code: 'EXPENSE_ALREADY_CANCELLED',
      });
    }

    await this.prisma.$transaction(async (db) => {
      // a) Soft-mark the expense.
      await db.expense.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });

      // b) SUPPLIER_PAYMENT → reverse the supplier tx + balance.
      if (expense.type === 'SUPPLIER_PAYMENT' && expense.referenceId) {
        const linkedTx = await db.supplierTransaction.findFirst({
          where: {
            id: expense.referenceId,
            type: 'PAYMENT',
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
          const supplier = await db.supplier.findUniqueOrThrow({
            where: { id: linkedTx.supplierId },
          });
          // Reverse: add the amount back to the supplier balance.
          const newBalance = Number(supplier.currentBalance) + Number(expense.amount);
          await db.supplier.update({
            where: { id: linkedTx.supplierId },
            data: { currentBalance: newBalance },
          });
        }
      }

      // c) Audit.
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'cancel',
        entityType: 'expense',
        entityId: id,
        oldValues: {
          type: expense.type,
          amount: String(expense.amount),
        },
        newValues: { reason: input.reason },
      });
    });

    // d) Recompute daily income for the affected day.
    await this.dailyIncome.recompute(scope.storeId, expense.expenseDate);

    return this.findOne(scope, id);
  }
}
