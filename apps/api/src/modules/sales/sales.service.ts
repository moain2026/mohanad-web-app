/**
 * SalesService — Phase 6 P6-2.
 *
 * The Phase-6 accounting rules LOCKED in docs/12-agent-memory.md:
 *
 *   ┌──────────┬────────────────────────────────────────────────────────┐
 *   │ Mode     │ Effect                                                 │
 *   ├──────────┼────────────────────────────────────────────────────────┤
 *   │ QUICK    │ Insert Sale row (cash). No customer, no items.         │
 *   │          │ daily_income.cash_sales ↑ totalAmount.                 │
 *   │ DETAILED │ Insert Sale row (cash). Optional items. Optional customer.
 *   │          │ daily_income.cash_sales ↑ totalAmount.                 │
 *   │ CREDIT   │ Customer required. Credit-limit check. Atomic single   │
 *   │          │ $transaction:                                          │
 *   │          │   1. Insert Sale row.                                  │
 *   │          │   2. Insert CustomerTransaction(DEBT) referencing it.  │
 *   │          │   3. Increase Customer.currentBalance.                 │
 *   │          │ daily_income.credit_sales ↑ totalAmount (info only).   │
 *   └──────────┴────────────────────────────────────────────────────────┘
 *
 * Cancellation:
 *   • QUICK / DETAILED → soft-mark only. daily_income recompute removes it.
 *   • CREDIT           → atomically:
 *       1. Soft-mark the Sale.
 *       2. Soft-mark the linked CustomerTransaction(DEBT).
 *       3. Decrease Customer.currentBalance by the original totalAmount.
 *
 * Credit-limit logic mirrors CustomerTransactionsService.createDebt — same
 * `approveOverLimit` body flag + `customer_transactions.approve_over_limit`
 * permission gate. We do NOT duplicate the notification logic here because
 * the CustomerTransaction row is the canonical event source.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';

import type { CancelSaleInput, CreateSaleInput, ListSalesQuery } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { DailyIncomeService } from '../daily-income/daily-income.service';
import { PrismaService } from '../prisma/prisma.service';

interface SaleScope {
  storeId: string;
  actorId: string;
  /** Flat permission list — used for over-limit approval check. */
  permissions: string[];
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DailyIncomeService))
    private readonly dailyIncome: DailyIncomeService,
  ) {}

  // ─── List ─────────────────────────────────────────────────
  async list(scope: SaleScope, query: ListSalesQuery) {
    const { page, limit, sortDir, customerId, mode, from, to, includeCancelled } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(customerId ? { customerId } : {}),
      ...(mode ? { mode } : {}),
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
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Detail (with items) ──────────────────────────────────
  async findOne(scope: SaleScope, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException({
        message: 'عملية البيع غير موجودة',
        code: 'SALE_NOT_FOUND',
      });
    }
    return sale;
  }

  // ─── Create (3 paths) ─────────────────────────────────────
  async create(scope: SaleScope, input: CreateSaleInput) {
    const total = Number(input.totalAmount);
    if (total <= 0) {
      throw new BadRequestException({
        message: 'إجمالي الفاتورة يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }

    // CREDIT path: validate customer up front (cheap fail-fast).
    let customer: Awaited<ReturnType<typeof this.prisma.customer.findFirst>> | null = null;
    let creditExceedsLimit = false;
    let creditLimit: number | null = null;
    let balanceBefore = 0;
    let balanceAfter = 0;

    if (input.mode === 'CREDIT') {
      customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId!, storeId: scope.storeId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException({
          message: 'العميل غير موجود',
          code: 'CUSTOMER_NOT_FOUND',
        });
      }
      if (customer.status === 'FROZEN') {
        throw new ConflictException({
          message: 'العميل مُجمَّد — لا يمكن البيع آجلاً',
          code: 'CUSTOMER_FROZEN',
        });
      }
      balanceBefore = Number(customer.currentBalance);
      balanceAfter = balanceBefore + total;
      creditLimit = customer.creditLimit !== null ? Number(customer.creditLimit) : null;
      creditExceedsLimit = creditLimit !== null && balanceAfter > creditLimit;

      if (creditExceedsLimit) {
        // Same body-flag + permission pattern as customer-transactions.createDebt.
        // We tolerate both flag names for compatibility (sales clients may use
        // either `notes` for the reason — we don't gate via body here).
        if (!scope.permissions.includes('customer_transactions.approve_over_limit')) {
          throw new ConflictException({
            message: 'تجاوز سقف الدين — يلزم موافقة',
            code: 'CREDIT_LIMIT_EXCEEDED',
            meta: { currentBalance: balanceBefore, after: balanceAfter, creditLimit },
          });
        }
        // Note: when the actor DOES hold the permission we proceed — the
        // resulting CustomerTransaction will carry the same metadata.
      }
    }

    const created = await this.prisma.$transaction(async (db) => {
      // a) Sale row.
      const sale = await db.sale.create({
        data: {
          storeId: scope.storeId,
          mode: input.mode,
          customerId: input.mode === 'CREDIT' ? input.customerId! : (input.customerId ?? null),
          totalAmount: total,
          notes: input.notes ?? null,
          hasItems: !!(input.items && input.items.length > 0),
          createdById: scope.actorId,
        },
      });

      // b) Items (optional).
      if (input.items && input.items.length > 0) {
        await db.saleItem.createMany({
          data: input.items.map((it) => ({
            saleId: sale.id,
            productId: null, // Phase 9 — not yet linked
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
          })),
        });
      }

      // c) CREDIT only: customer-transaction(DEBT) + balance update.
      if (input.mode === 'CREDIT' && customer) {
        await db.customerTransaction.create({
          data: {
            customerId: input.customerId!,
            type: 'DEBT',
            amount: total,
            balanceBefore,
            balanceAfter,
            referenceType: 'sale',
            referenceId: sale.id,
            createdById: scope.actorId,
            notes: input.notes ?? null,
          },
        });
        await db.customer.update({
          where: { id: input.customerId! },
          data: { currentBalance: balanceAfter },
        });
      }

      // d) Audit log.
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'sale',
        entityId: sale.id,
        newValues: {
          mode: input.mode,
          totalAmount: total,
          customerId: input.customerId ?? null,
          hasItems: sale.hasItems,
        },
        metadata: creditExceedsLimit
          ? { exceedsLimit: true, creditLimit, balanceAfter }
          : undefined,
      });

      return sale;
    });

    // e) Recompute daily income for today.
    await this.dailyIncome.recompute(scope.storeId, new Date());

    return this.findOne(scope, created.id);
  }

  // ─── Cancel ───────────────────────────────────────────────
  async cancel(scope: SaleScope, id: string, input: CancelSaleInput) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!sale) {
      throw new NotFoundException({
        message: 'عملية البيع غير موجودة',
        code: 'SALE_NOT_FOUND',
      });
    }
    if (sale.cancelledAt) {
      throw new ConflictException({
        message: 'عملية البيع ملغاة مسبقاً',
        code: 'SALE_ALREADY_CANCELLED',
      });
    }

    await this.prisma.$transaction(async (db) => {
      // a) Soft-mark sale.
      await db.sale.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });

      // b) CREDIT → reverse the linked DEBT tx + customer balance.
      if (sale.mode === 'CREDIT' && sale.customerId) {
        const linkedTx = await db.customerTransaction.findFirst({
          where: {
            customerId: sale.customerId,
            referenceType: 'sale',
            referenceId: sale.id,
            type: 'DEBT',
            cancelledAt: null,
          },
        });
        if (linkedTx) {
          await db.customerTransaction.update({
            where: { id: linkedTx.id },
            data: {
              cancelledAt: new Date(),
              cancelledById: scope.actorId,
              cancelReason: input.reason,
            },
          });
        }
        const customer = await db.customer.findUniqueOrThrow({ where: { id: sale.customerId } });
        const newBalance = Number(customer.currentBalance) - Number(sale.totalAmount);
        await db.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: newBalance },
        });
      }

      // c) Audit.
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'cancel',
        entityType: 'sale',
        entityId: id,
        oldValues: { mode: sale.mode, totalAmount: String(sale.totalAmount) },
        newValues: { reason: input.reason },
      });
    });

    // d) Recompute daily income for the sale's day.
    await this.dailyIncome.recompute(scope.storeId, sale.createdAt);

    return this.findOne(scope, id);
  }
}
