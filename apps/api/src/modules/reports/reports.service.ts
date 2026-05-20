/**
 * ReportsService — Phase 7 P7-2.
 *
 * All reports are computed on-the-fly from authoritative source tables.
 * No "report cache" is queried at read time — ReportSnapshot is used purely
 * for printable/exported reports that need a stable timestamp.
 *
 * Money invariants (LOCKED — docs/12-agent-memory.md):
 *   • cashSales       = Σ sales WHERE mode IN (QUICK, DETAILED) AND !cancelled
 *   • creditSales     = Σ sales WHERE mode = CREDIT AND !cancelled
 *   • cashPurchases   = Σ purchases WHERE paymentType = CASH AND !cancelled
 *   • creditPurchases = Σ purchases WHERE paymentType = CREDIT AND !cancelled
 *   • normalExpenses  = Σ expenses WHERE type = NORMAL AND !cancelled
 *   • supplierPayments= Σ expenses WHERE type = SUPPLIER_PAYMENT AND !cancelled
 *                       (NOT from purchases — those are credit-purchases.)
 *   • customerPayments= Σ customer_transactions WHERE type = PAYMENT AND !cancelled
 *   • netProfitEstim  = cashSales + creditSales − cashPurchases − creditPurchases
 *                       − normalExpenses
 *
 * Date semantics:
 *   • Sale.createdAt    is timestamp — use day-range comparisons
 *   • Purchase.createdAt is timestamp — same
 *   • Expense.expenseDate is DATE — use equality / between for ranges
 *   • DailyIncome.date is DATE — direct equality
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

/** Normalise to UTC start-of-day. */
function toDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function toDayEnd(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

/** Inclusive range [gte, lt). */
function dayRange(d: Date): { gte: Date; lt: Date } {
  const gte = toDayStart(d);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

/** Range from optional `from`/`to`. Defaults to today. */
function rangeOrToday(from?: Date, to?: Date): { gte: Date; lte: Date } {
  if (!from && !to) {
    const now = new Date();
    return { gte: toDayStart(now), lte: toDayEnd(now) };
  }
  const gte = from ? toDayStart(from) : new Date('1970-01-01');
  const lte = to ? toDayEnd(to) : toDayEnd(new Date());
  return { gte, lte };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  //  1. DASHBOARD KPIs (today + this month + alerts)
  // ═══════════════════════════════════════════════════════
  async dashboard(scope: Scope) {
    const now = new Date();
    const todayRange = dayRange(now);

    // Month range
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [
      todaySalesAgg,
      monthSalesAgg,
      todayExpensesAgg,
      monthExpensesAgg,
      customersWithDebt,
      lowStockCount,
      customersCount,
      suppliersCount,
      todayDaily,
      pendingNotifs,
      last7DaysSeries,
    ] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['mode'],
        where: { storeId: scope.storeId, cancelledAt: null, createdAt: todayRange },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          storeId: scope.storeId,
          cancelledAt: null,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          storeId: scope.storeId,
          cancelledAt: null,
          expenseDate: toDayStart(now),
          type: 'NORMAL',
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          storeId: scope.storeId,
          cancelledAt: null,
          expenseDate: { gte: monthStart, lt: monthEnd },
          type: 'NORMAL',
        },
        _sum: { amount: true },
      }),
      this.prisma.customer.aggregate({
        where: {
          storeId: scope.storeId,
          deletedAt: null,
          currentBalance: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { currentBalance: true },
      }),
      this.prisma.product
        .count({
          where: {
            storeId: scope.storeId,
            deletedAt: null,
            isActive: true,
            currentStock: { lte: this.prisma.product.fields.reorderLevel },
          },
        })
        .catch(() => 0), // Inventory may be disabled or product table empty.
      this.prisma.customer.count({
        where: { storeId: scope.storeId, deletedAt: null },
      }),
      this.prisma.supplier.count({
        where: { storeId: scope.storeId, deletedAt: null },
      }),
      this.prisma.dailyIncome.findUnique({
        where: { storeId_date: { storeId: scope.storeId, date: toDayStart(now) } },
      }),
      this.prisma.notification.count({
        where: { storeId: scope.storeId, readAt: null },
      }),
      this.last7DaysSeries(scope.storeId, now),
    ]);

    const cashSalesToday = todaySalesAgg
      .filter((g) => g.mode === 'QUICK' || g.mode === 'DETAILED')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const creditSalesToday = todaySalesAgg
      .filter((g) => g.mode === 'CREDIT')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const todaySalesTotal = cashSalesToday + creditSalesToday;
    const todaySalesCount = todaySalesAgg.reduce((a, g) => a + g._count._all, 0);

    const todayExpensesTotal = Number(todayExpensesAgg._sum.amount ?? 0);
    const monthSalesTotal = Number(monthSalesAgg._sum.totalAmount ?? 0);
    const monthExpensesTotal = Number(monthExpensesAgg._sum.amount ?? 0);

    return {
      today: {
        date: toDayStart(now).toISOString(),
        salesTotal: todaySalesTotal,
        salesCount: todaySalesCount,
        cashSales: cashSalesToday,
        creditSales: creditSalesToday,
        expenses: todayExpensesTotal,
        netProfit: todaySalesTotal - todayExpensesTotal,
        closingCash: Number(todayDaily?.closingCash ?? 0),
      },
      month: {
        salesTotal: monthSalesTotal,
        salesCount: monthSalesAgg._count._all,
        expenses: monthExpensesTotal,
        netProfit: monthSalesTotal - monthExpensesTotal,
      },
      customers: {
        total: customersCount,
        withDebt: customersWithDebt._count._all,
        totalDebt: Number(customersWithDebt._sum.currentBalance ?? 0),
      },
      suppliers: {
        total: suppliersCount,
      },
      inventory: {
        lowStockCount,
      },
      notifications: {
        unread: pendingNotifs,
      },
      charts: {
        last7Days: last7DaysSeries,
      },
    };
  }

  /** Internal — last-7-days series for the dashboard sparkline. */
  private async last7DaysSeries(storeId: string, anchor: Date) {
    const days: Array<{ date: string; sales: number; expenses: number; net: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setUTCDate(d.getUTCDate() - i);
      const start = toDayStart(d);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const [salesAgg, expensesAgg] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { storeId, cancelledAt: null, createdAt: { gte: start, lt: end } },
          _sum: { totalAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: { storeId, cancelledAt: null, expenseDate: start, type: 'NORMAL' },
          _sum: { amount: true },
        }),
      ]);
      const sales = Number(salesAgg._sum.totalAmount ?? 0);
      const expenses = Number(expensesAgg._sum.amount ?? 0);
      days.push({
        date: start.toISOString().slice(0, 10),
        sales,
        expenses,
        net: sales - expenses,
      });
    }
    return days;
  }

  // ═══════════════════════════════════════════════════════
  //  2. DAILY SUMMARY (one day)
  // ═══════════════════════════════════════════════════════
  async dailySummary(scope: Scope, date?: Date) {
    const day = toDayStart(date ?? new Date());
    const range = dayRange(day);

    const [
      salesByMode,
      cashPurchasesAgg,
      creditPurchasesAgg,
      expenseByType,
      customerPayments,
      dailyRow,
    ] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['mode'],
        where: { storeId: scope.storeId, cancelledAt: null, createdAt: range },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.purchase.aggregate({
        where: {
          storeId: scope.storeId,
          paymentType: 'CASH',
          cancelledAt: null,
          createdAt: range,
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.purchase.aggregate({
        where: {
          storeId: scope.storeId,
          paymentType: 'CREDIT',
          cancelledAt: null,
          createdAt: range,
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ['type'],
        where: { storeId: scope.storeId, cancelledAt: null, expenseDate: day },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.customerTransaction.aggregate({
        where: {
          customer: { storeId: scope.storeId },
          cancelledAt: null,
          createdAt: range,
          type: 'PAYMENT',
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.dailyIncome.findUnique({
        where: { storeId_date: { storeId: scope.storeId, date: day } },
      }),
    ]);

    const cashSales = salesByMode
      .filter((g) => g.mode === 'QUICK' || g.mode === 'DETAILED')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const creditSales = salesByMode
      .filter((g) => g.mode === 'CREDIT')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const normalExpenses = Number(expenseByType.find((e) => e.type === 'NORMAL')?._sum.amount ?? 0);
    const supplierPayments = Number(
      expenseByType.find((e) => e.type === 'SUPPLIER_PAYMENT')?._sum.amount ?? 0,
    );

    return {
      date: day.toISOString().slice(0, 10),
      openingCash: Number(dailyRow?.openingCash ?? 0),
      sales: {
        cashSales,
        creditSales,
        total: cashSales + creditSales,
        countByMode: salesByMode.map((g) => ({ mode: g.mode, count: g._count._all })),
      },
      purchases: {
        cashTotal: Number(cashPurchasesAgg._sum.totalAmount ?? 0),
        cashCount: cashPurchasesAgg._count._all,
        creditTotal: Number(creditPurchasesAgg._sum.totalAmount ?? 0),
        creditCount: creditPurchasesAgg._count._all,
      },
      expenses: {
        normal: normalExpenses,
        supplierPayments,
        total: normalExpenses + supplierPayments,
      },
      customerPayments: Number(customerPayments._sum.amount ?? 0),
      closingCash: Number(dailyRow?.closingCash ?? 0),
      isClosed: !!dailyRow?.closedAt,
      // Estimated P&L (cash + credit sales − cash + credit purchases − normal expenses)
      netProfit:
        cashSales +
        creditSales -
        Number(cashPurchasesAgg._sum.totalAmount ?? 0) -
        Number(creditPurchasesAgg._sum.totalAmount ?? 0) -
        normalExpenses,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  3. PROFIT & LOSS (range)
  // ═══════════════════════════════════════════════════════
  async profitLoss(scope: Scope, from?: Date, to?: Date) {
    const { gte, lte } = rangeOrToday(from, to);

    const [salesByMode, cashPurchasesAgg, creditPurchasesAgg, normalExpensesAgg] =
      await Promise.all([
        this.prisma.sale.groupBy({
          by: ['mode'],
          where: {
            storeId: scope.storeId,
            cancelledAt: null,
            createdAt: { gte, lte },
          },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        this.prisma.purchase.aggregate({
          where: {
            storeId: scope.storeId,
            paymentType: 'CASH',
            cancelledAt: null,
            createdAt: { gte, lte },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.purchase.aggregate({
          where: {
            storeId: scope.storeId,
            paymentType: 'CREDIT',
            cancelledAt: null,
            createdAt: { gte, lte },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            storeId: scope.storeId,
            cancelledAt: null,
            type: 'NORMAL',
            expenseDate: { gte, lte },
          },
          _sum: { amount: true },
        }),
      ]);

    const cashSales = salesByMode
      .filter((g) => g.mode === 'QUICK' || g.mode === 'DETAILED')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const creditSales = salesByMode
      .filter((g) => g.mode === 'CREDIT')
      .reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);
    const totalSales = cashSales + creditSales;
    const cashPurchases = Number(cashPurchasesAgg._sum.totalAmount ?? 0);
    const creditPurchases = Number(creditPurchasesAgg._sum.totalAmount ?? 0);
    const totalPurchases = cashPurchases + creditPurchases;
    const normalExpenses = Number(normalExpensesAgg._sum.amount ?? 0);

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      sales: { cashSales, creditSales, totalSales },
      purchases: { cashPurchases, creditPurchases, totalPurchases },
      expenses: { normal: normalExpenses },
      // Note: "estimated" because true COGS requires inventory (Phase 9).
      grossProfit: totalSales - totalPurchases,
      netProfit: totalSales - totalPurchases - normalExpenses,
      isEstimated: true,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  4. CASH FLOW (range)
  // ═══════════════════════════════════════════════════════
  async cashFlow(scope: Scope, from?: Date, to?: Date) {
    const { gte, lte } = rangeOrToday(from, to);

    const [cashSalesAgg, customerPaymentsAgg, cashPurchasesAgg, expensesAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          storeId: scope.storeId,
          mode: { in: ['QUICK', 'DETAILED'] },
          cancelledAt: null,
          createdAt: { gte, lte },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.customerTransaction.aggregate({
        where: {
          customer: { storeId: scope.storeId },
          cancelledAt: null,
          type: 'PAYMENT',
          createdAt: { gte, lte },
        },
        _sum: { amount: true },
      }),
      this.prisma.purchase.aggregate({
        where: {
          storeId: scope.storeId,
          paymentType: 'CASH',
          cancelledAt: null,
          createdAt: { gte, lte },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['type'],
        where: {
          storeId: scope.storeId,
          cancelledAt: null,
          type: { in: ['NORMAL', 'SUPPLIER_PAYMENT'] },
          expenseDate: { gte, lte },
        },
        _sum: { amount: true },
      }),
    ]);

    const cashSales = Number(cashSalesAgg._sum.totalAmount ?? 0);
    const customerPayments = Number(customerPaymentsAgg._sum.amount ?? 0);
    const cashPurchases = Number(cashPurchasesAgg._sum.totalAmount ?? 0);
    const normalExpenses = Number(expensesAgg.find((e) => e.type === 'NORMAL')?._sum.amount ?? 0);
    const supplierPayments = Number(
      expensesAgg.find((e) => e.type === 'SUPPLIER_PAYMENT')?._sum.amount ?? 0,
    );

    const inflows = cashSales + customerPayments;
    const outflows = cashPurchases + normalExpenses + supplierPayments;

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      inflows: {
        cashSales,
        customerPayments,
        total: inflows,
      },
      outflows: {
        cashPurchases,
        normalExpenses,
        supplierPayments,
        total: outflows,
      },
      net: inflows - outflows,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  5. CUSTOMER DEBTS AGEING
  // ═══════════════════════════════════════════════════════
  async customerDebts(scope: Scope, asOf?: Date) {
    const now = asOf ?? new Date();
    const buckets = [30, 60, 90, 180]; // days

    const customers = await this.prisma.customer.findMany({
      where: {
        storeId: scope.storeId,
        deletedAt: null,
        currentBalance: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        currentBalance: true,
        creditLimit: true,
        status: true,
        transactions: {
          where: { type: 'DEBT', cancelledAt: null },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { currentBalance: 'desc' },
    });

    const summary = {
      total: 0,
      totalDebt: 0,
      byBucket: {
        '0-30': { count: 0, debt: 0 },
        '31-60': { count: 0, debt: 0 },
        '61-90': { count: 0, debt: 0 },
        '91-180': { count: 0, debt: 0 },
        '180+': { count: 0, debt: 0 },
      } as Record<string, { count: number; debt: number }>,
    };

    const items = customers.map((c) => {
      const balance = Number(c.currentBalance);
      const lastDebtAt = c.transactions[0]?.createdAt ?? null;
      let ageDays = 0;
      if (lastDebtAt) {
        ageDays = Math.floor((now.getTime() - lastDebtAt.getTime()) / (1000 * 60 * 60 * 24));
      }
      let bucket = '0-30';
      if (ageDays > 180) bucket = '180+';
      else if (ageDays > 90) bucket = '91-180';
      else if (ageDays > 60) bucket = '61-90';
      else if (ageDays > 30) bucket = '31-60';

      summary.total += 1;
      summary.totalDebt += balance;
      summary.byBucket[bucket]!.count += 1;
      summary.byBucket[bucket]!.debt += balance;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance,
        creditLimit: c.creditLimit !== null ? Number(c.creditLimit) : null,
        status: c.status,
        lastDebtAt,
        ageDays,
        bucket,
      };
    });

    void buckets;
    return { asOf: now.toISOString(), summary, items };
  }

  // ═══════════════════════════════════════════════════════
  //  6. SUPPLIER BALANCES
  // ═══════════════════════════════════════════════════════
  async supplierBalances(scope: Scope, asOf?: Date) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        currentBalance: true,
        isActive: true,
      },
      orderBy: { currentBalance: 'desc' },
    });

    let totalOwed = 0;
    const items = suppliers.map((s) => {
      const balance = Number(s.currentBalance);
      if (balance > 0) totalOwed += balance;
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        balance,
        isActive: s.isActive,
      };
    });

    return {
      asOf: (asOf ?? new Date()).toISOString(),
      summary: {
        total: items.length,
        totalOwed,
        suppliersWithBalance: items.filter((i) => i.balance > 0).length,
      },
      items,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  7. TOP CUSTOMERS (by sales in range)
  // ═══════════════════════════════════════════════════════
  async topCustomers(scope: Scope, from?: Date, to?: Date, limit = 10) {
    const { gte, lte } = rangeOrToday(from, to);

    const grouped = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        createdAt: { gte, lte },
        customerId: { not: null },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId!).filter(Boolean) } },
      select: { id: true, name: true, phone: true, currentBalance: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      items: grouped.map((g) => {
        const c = g.customerId ? map.get(g.customerId) : null;
        return {
          customerId: g.customerId,
          customerName: c?.name ?? '—',
          customerPhone: c?.phone ?? null,
          currentBalance: c ? Number(c.currentBalance) : 0,
          salesTotal: Number(g._sum.totalAmount ?? 0),
          salesCount: g._count._all,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════
  //  8. TOP ITEMS (by quantity in detailed sales)
  // ═══════════════════════════════════════════════════════
  async topItems(scope: Scope, from?: Date, to?: Date, limit = 10) {
    const { gte, lte } = rangeOrToday(from, to);

    // We group by SaleItem.name (since Product link is Phase 9 optional).
    const items = await this.prisma.saleItem.groupBy({
      by: ['name'],
      where: {
        sale: {
          storeId: scope.storeId,
          cancelledAt: null,
          createdAt: { gte, lte },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: { _all: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      items: items.map((i) => ({
        name: i.name,
        quantity: Number(i._sum.quantity ?? 0),
        revenue: Number(i._sum.totalPrice ?? 0),
        salesCount: i._count._all,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════
  //  9. EXPENSES BY CATEGORY
  // ═══════════════════════════════════════════════════════
  async expensesByCategory(scope: Scope, from?: Date, to?: Date) {
    const { gte, lte } = rangeOrToday(from, to);

    const grouped = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        type: 'NORMAL',
        expenseDate: { gte, lte },
      },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true },
    });
    const map = new Map(categories.map((c) => [c.id, c]));

    const totalAmount = grouped.reduce((a, g) => a + Number(g._sum.amount ?? 0), 0);

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      summary: { totalAmount, categoryCount: grouped.length },
      items: grouped.map((g) => {
        const amount = Number(g._sum.amount ?? 0);
        return {
          categoryId: g.categoryId,
          categoryName: map.get(g.categoryId)?.name ?? '—',
          amount,
          count: g._count._all,
          percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════
  // 10. SALES BY MODE
  // ═══════════════════════════════════════════════════════
  async salesByMode(scope: Scope, from?: Date, to?: Date) {
    const { gte, lte } = rangeOrToday(from, to);

    const grouped = await this.prisma.sale.groupBy({
      by: ['mode'],
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        createdAt: { gte, lte },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const total = grouped.reduce((a, g) => a + Number(g._sum.totalAmount ?? 0), 0);

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      summary: { total, modeCount: grouped.length },
      items: grouped.map((g) => {
        const amount = Number(g._sum.totalAmount ?? 0);
        return {
          mode: g.mode,
          amount,
          count: g._count._all,
          percentage: total > 0 ? (amount / total) * 100 : 0,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════
  // 11. SALES BY WORKER
  // ═══════════════════════════════════════════════════════
  async salesByWorker(scope: Scope, from?: Date, to?: Date) {
    const { gte, lte } = rangeOrToday(from, to);

    const grouped = await this.prisma.sale.groupBy({
      by: ['createdById'],
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        createdAt: { gte, lte },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.createdById) } },
      select: { id: true, username: true, fullName: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));

    return {
      range: { from: gte.toISOString(), to: lte.toISOString() },
      items: grouped.map((g) => ({
        userId: g.createdById,
        username: map.get(g.createdById)?.username ?? '—',
        fullName: map.get(g.createdById)?.fullName ?? '—',
        salesTotal: Number(g._sum.totalAmount ?? 0),
        salesCount: g._count._all,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════
  // 12. MONTHLY SUMMARY (one calendar month)
  // ═══════════════════════════════════════════════════════
  async monthlySummary(scope: Scope, month?: string) {
    let year: number;
    let monthIdx: number;
    if (month) {
      const [y, m] = month.split('-');
      year = Number(y);
      monthIdx = Number(m) - 1;
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIdx = now.getUTCMonth();
    }
    const from = new Date(Date.UTC(year, monthIdx, 1));
    const to = new Date(Date.UTC(year, monthIdx + 1, 1));

    // Reuse profit-loss machinery but with month boundaries.
    const pl = await this.profitLoss(scope, from, new Date(to.getTime() - 1));
    const cf = await this.cashFlow(scope, from, new Date(to.getTime() - 1));

    // Daily breakdown for the month (sales / expenses per day).
    const dailyRows = await this.prisma.dailyIncome.findMany({
      where: { storeId: scope.storeId, date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
    });

    return {
      month: `${year}-${String(monthIdx + 1).padStart(2, '0')}`,
      from: from.toISOString(),
      to: new Date(to.getTime() - 1).toISOString(),
      profitLoss: pl,
      cashFlow: cf,
      dailyBreakdown: dailyRows.map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        cashSales: Number(d.cashSales),
        creditSales: Number(d.creditSales),
        normalExpenses: Number(d.normalExpenses),
        closingCash: Number(d.closingCash),
        isClosed: !!d.closedAt,
      })),
    };
  }
}
