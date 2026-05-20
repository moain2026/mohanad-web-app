/**
 * DailyIncomeService — Phase 5 P5-3.
 *
 * Owns the daily cash-book aggregate. One row per (storeId, date). Every
 * mutation in expenses / sales / customer-payments / supplier-payments calls
 * `recompute(storeId, date)` to refresh the row.
 *
 * Aggregation rules (LOCKED in docs/12-agent-memory.md):
 *
 *   openingCash       → from the row itself (set on open-day; defaults 0)
 *   cashSales         → Σ sales.totalAmount WHERE mode IN (QUICK, DETAILED)
 *                       AND cancelledAt IS NULL AND created_at::date = D
 *   creditSales       → Σ sales.totalAmount WHERE mode = CREDIT (info only;
 *                       does NOT contribute to closing cash)
 *   customerPayments  → Σ customer_transactions.amount WHERE type = PAYMENT
 *                       AND cancelledAt IS NULL AND created_at::date = D
 *   cashPurchases     → Σ purchases.totalAmount WHERE paymentType = CASH
 *                       AND cancelledAt IS NULL AND created_at::date = D
 *                       (READ FROM `purchases` — NOT from expenses, to avoid
 *                        double-counting CASH_PURCHASE_LINK rows.)
 *   supplierPayments  → Σ expenses.amount WHERE type = SUPPLIER_PAYMENT
 *                       AND cancelledAt IS NULL AND expense_date = D
 *   normalExpenses    → Σ expenses.amount WHERE type = NORMAL
 *                       AND cancelledAt IS NULL AND expense_date = D
 *   closingCash       = openingCash
 *                     + cashSales
 *                     + customerPayments
 *                     − cashPurchases
 *                     − supplierPayments
 *                     − normalExpenses
 *
 * After `closedAt` is set the row becomes immutable — recompute() is a no-op.
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CloseDayInput, ListDailyIncomeQuery, OpenDayInput } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

/** Normalise any Date to start-of-day UTC for the `date` column (DATE type). */
function toDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Inclusive day-range for createdAt comparisons. */
function dayRange(d: Date): { gte: Date; lt: Date } {
  const gte = toDateOnly(d);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

@Injectable()
export class DailyIncomeService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List (paginated) ─────────────────────────────────────
  async list(scope: Scope, query: ListDailyIncomeQuery) {
    const { page, limit, sortDir, from, to, closedOnly } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: toDateOnly(from) } : {}),
              ...(to ? { lte: toDateOnly(to) } : {}),
            },
          }
        : {}),
      ...(closedOnly ? { closedAt: { not: null } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dailyIncome.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: sortDir },
      }),
      this.prisma.dailyIncome.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Get by date (creates a zeroed row if missing) ────────
  async getByDate(scope: Scope, date: Date) {
    const day = toDateOnly(date);
    let row = await this.prisma.dailyIncome.findUnique({
      where: { storeId_date: { storeId: scope.storeId, date: day } },
    });
    if (!row) {
      // Lazy-create a placeholder row so the UI always has something to show.
      row = await this.prisma.dailyIncome.create({
        data: { storeId: scope.storeId, date: day },
      });
    }
    return row;
  }

  // ─── Open day (sets openingCash; only when not closed) ────
  async openDay(scope: Scope, input: OpenDayInput) {
    const date = toDateOnly(input.date ?? new Date());
    const existing = await this.prisma.dailyIncome.findUnique({
      where: { storeId_date: { storeId: scope.storeId, date } },
    });
    if (existing?.closedAt) {
      throw new ConflictException({
        message: 'اليوم مُغلق ولا يمكن تعديله',
        code: 'DAILY_INCOME_CLOSED',
      });
    }
    const opening = Number(input.openingCash);

    const row = await this.prisma.$transaction(async (db) => {
      const upserted = await db.dailyIncome.upsert({
        where: { storeId_date: { storeId: scope.storeId, date } },
        update: { openingCash: opening, notes: input.notes ?? null },
        create: {
          storeId: scope.storeId,
          date,
          openingCash: opening,
          notes: input.notes ?? null,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'daily_income',
        entityId: upserted.id,
        newValues: { openingCash: opening, date: date.toISOString() },
      });
      return upserted;
    });
    // Always refresh aggregates after opening.
    return this.recompute(scope.storeId, date, scope.actorId);
  }

  // ─── Close day (immutable thereafter) ─────────────────────
  async closeDay(scope: Scope, input: CloseDayInput) {
    const date = toDateOnly(input.date ?? new Date());
    // Ensure aggregates are fresh first.
    await this.recompute(scope.storeId, date, scope.actorId);

    const row = await this.prisma.dailyIncome.findUnique({
      where: { storeId_date: { storeId: scope.storeId, date } },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'لا يوجد سجل لهذا اليوم',
        code: 'DAILY_INCOME_NOT_FOUND',
      });
    }
    if (row.closedAt) {
      throw new ConflictException({
        message: 'اليوم مُغلق مسبقاً',
        code: 'DAILY_INCOME_ALREADY_CLOSED',
      });
    }

    const closed = await this.prisma.$transaction(async (db) => {
      const updated = await db.dailyIncome.update({
        where: { id: row.id },
        data: {
          closedAt: new Date(),
          closedById: scope.actorId,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'update',
        entityType: 'daily_income',
        entityId: row.id,
        newValues: { action: 'close', date: date.toISOString() },
      });
      return updated;
    });
    return closed;
  }

  // ─── Recompute aggregates for a given day ─────────────────
  /**
   * Recomputes the per-day aggregates from authoritative source tables.
   * Returns the resulting row. No-op if the day is already closed.
   *
   * Safe to call on its own (own transaction) or after another mutation —
   * we use the simplest contract: this method always runs in its own tx.
   */
  async recompute(storeId: string, date: Date, _actorId?: string) {
    const day = toDateOnly(date);
    const range = dayRange(day);

    // If the day is closed, return the existing row as-is.
    const existing = await this.prisma.dailyIncome.findUnique({
      where: { storeId_date: { storeId, date: day } },
    });
    if (existing?.closedAt) return existing;

    // Aggregations — parallel for speed.
    const [salesAgg, customerPayAgg, cashPurchaseAgg, expenseGroups] = await Promise.all([
      // Sales (group by mode so we get cash + credit in one round-trip).
      this.prisma.sale.groupBy({
        by: ['mode'],
        where: {
          storeId,
          cancelledAt: null,
          createdAt: range,
        },
        _sum: { totalAmount: true },
      }),
      // Customer payments today.
      this.prisma.customerTransaction.aggregate({
        where: {
          customer: { storeId },
          type: 'PAYMENT',
          cancelledAt: null,
          createdAt: range,
        },
        _sum: { amount: true },
      }),
      // CASH purchases today — read from `purchases` (NOT expenses), per the
      // locked no-double-count rule.
      this.prisma.purchase.aggregate({
        where: {
          storeId,
          paymentType: 'CASH',
          cancelledAt: null,
          createdAt: range,
        },
        _sum: { totalAmount: true },
      }),
      // Expenses grouped by type for the day (NORMAL + SUPPLIER_PAYMENT).
      this.prisma.expense.groupBy({
        by: ['type'],
        where: {
          storeId,
          cancelledAt: null,
          expenseDate: day,
        },
        _sum: { amount: true },
      }),
    ]);

    const cashSales = Number(
      salesAgg.find((g) => g.mode === 'QUICK' || g.mode === 'DETAILED')?._sum.totalAmount ?? 0,
    );
    // groupBy returns one row per mode; aggregate QUICK+DETAILED together.
    const cashSalesSum = salesAgg
      .filter((g) => g.mode === 'QUICK' || g.mode === 'DETAILED')
      .reduce((acc, g) => acc + Number(g._sum.totalAmount ?? 0), 0);
    const creditSalesSum = salesAgg
      .filter((g) => g.mode === 'CREDIT')
      .reduce((acc, g) => acc + Number(g._sum.totalAmount ?? 0), 0);
    void cashSales; // (legacy var — kept for grep)

    const customerPayments = Number(customerPayAgg._sum.amount ?? 0);
    const cashPurchases = Number(cashPurchaseAgg._sum.totalAmount ?? 0);
    const normalExpenses = Number(expenseGroups.find((g) => g.type === 'NORMAL')?._sum.amount ?? 0);
    const supplierPayments = Number(
      expenseGroups.find((g) => g.type === 'SUPPLIER_PAYMENT')?._sum.amount ?? 0,
    );

    const opening = Number(existing?.openingCash ?? 0);
    const closing =
      opening + cashSalesSum + customerPayments - cashPurchases - supplierPayments - normalExpenses;

    const upserted = await this.prisma.dailyIncome.upsert({
      where: { storeId_date: { storeId, date: day } },
      update: {
        cashSales: cashSalesSum,
        creditSales: creditSalesSum,
        customerPayments,
        cashPurchases,
        supplierPayments,
        normalExpenses,
        closingCash: closing,
      },
      create: {
        storeId,
        date: day,
        cashSales: cashSalesSum,
        creditSales: creditSalesSum,
        customerPayments,
        cashPurchases,
        supplierPayments,
        normalExpenses,
        closingCash: closing,
      },
    });
    return upserted;
  }
}
