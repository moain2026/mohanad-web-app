/**
 * DailyIncomeService — Jest spec (Phase 5 P5-3).
 *
 * Locked-rule invariants exercised here:
 *
 *   ✅ Recompute reads cash_purchases from `purchases` (NOT from expenses) —
 *      this is the no-double-count rule for CASH_PURCHASE_LINK expenses.
 *   ✅ closingCash formula:
 *        opening + cashSales + customerPayments
 *          − cashPurchases − supplierPayments − normalExpenses
 *   ✅ Closed-day recompute is a no-op (immutable).
 *   ✅ openDay refuses to overwrite a closed day.
 *   ✅ closeDay sets closedAt + closedById.
 */

import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { DailyIncomeService } from '../daily-income.service';

const SCOPE = { storeId: 'store-1', actorId: 'actor-1' };

const buildPrismaMock = () => ({
  dailyIncome: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  sale: {
    groupBy: jest.fn(),
  },
  customerTransaction: {
    aggregate: jest.fn(),
  },
  purchase: {
    aggregate: jest.fn(),
  },
  expense: {
    groupBy: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

describe('DailyIncomeService', () => {
  let service: DailyIncomeService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const m = await Test.createTestingModule({
      providers: [DailyIncomeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(DailyIncomeService);
  });

  // ─── recompute ───────────────────────────────────────────
  describe('recompute', () => {
    it('is a no-op when the day is already closed', async () => {
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        closedAt: new Date(),
      });

      const result = await service.recompute('store-1', new Date('2026-05-20'));
      expect(result).toEqual({ id: 'd1', closedAt: expect.any(Date) });
      // ⭐ INVARIANT — no aggregation called
      expect(prisma.sale.groupBy).not.toHaveBeenCalled();
      expect(prisma.purchase.aggregate).not.toHaveBeenCalled();
      expect(prisma.expense.groupBy).not.toHaveBeenCalled();
      expect(prisma.dailyIncome.upsert).not.toHaveBeenCalled();
    });

    it('reads cash_purchases from purchases (NOT from expenses) — no double count', async () => {
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        openingCash: '100',
        closedAt: null,
      });
      prisma.sale.groupBy.mockResolvedValue([]);
      prisma.customerTransaction.aggregate.mockResolvedValue({ _sum: { amount: '0' } });
      prisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: '250' } });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.dailyIncome.upsert.mockResolvedValue({ id: 'd1' });

      await service.recompute('store-1', new Date('2026-05-20T10:00:00Z'));

      // ⭐ CRITICAL INVARIANT — purchase.aggregate must be queried with paymentType=CASH
      expect(prisma.purchase.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: 'store-1',
            paymentType: 'CASH',
            cancelledAt: null,
          }),
          _sum: { totalAmount: true },
        }),
      );

      // ⭐ CRITICAL INVARIANT — the upsert uses the purchases.aggregate result
      // for cash_purchases (NOT a CASH_PURCHASE_LINK expense sum).
      expect(prisma.dailyIncome.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ cashPurchases: 250 }),
        }),
      );
    });

    it('computes closing = opening + cashSales + customerPayments − cashPurchases − supplierPayments − normalExpenses', async () => {
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        openingCash: '1000',
        closedAt: null,
      });
      prisma.sale.groupBy.mockResolvedValue([
        { mode: 'QUICK', _sum: { totalAmount: '300' } },
        { mode: 'DETAILED', _sum: { totalAmount: '200' } }, // cash total = 500
        { mode: 'CREDIT', _sum: { totalAmount: '400' } }, // ignored in closing
      ]);
      prisma.customerTransaction.aggregate.mockResolvedValue({ _sum: { amount: '150' } });
      prisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: '120' } });
      prisma.expense.groupBy.mockResolvedValue([
        { type: 'NORMAL', _sum: { amount: '80' } },
        { type: 'SUPPLIER_PAYMENT', _sum: { amount: '90' } },
      ]);
      prisma.dailyIncome.upsert.mockResolvedValue({ id: 'd1' });

      await service.recompute('store-1', new Date('2026-05-20'));

      // closing = 1000 + 500 + 150 − 120 − 90 − 80 = 1360
      expect(prisma.dailyIncome.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            cashSales: 500,
            creditSales: 400,
            customerPayments: 150,
            cashPurchases: 120,
            supplierPayments: 90,
            normalExpenses: 80,
            closingCash: 1360,
          }),
        }),
      );
    });

    it('treats missing aggregates as zero (handles empty day)', async () => {
      prisma.dailyIncome.findUnique.mockResolvedValue(null);
      prisma.sale.groupBy.mockResolvedValue([]);
      prisma.customerTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.dailyIncome.upsert.mockResolvedValue({ id: 'd1' });

      await service.recompute('store-1', new Date('2026-05-20'));

      expect(prisma.dailyIncome.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            cashSales: 0,
            creditSales: 0,
            customerPayments: 0,
            cashPurchases: 0,
            supplierPayments: 0,
            normalExpenses: 0,
            closingCash: 0, // opening was 0 (no existing row)
          }),
        }),
      );
    });
  });

  // ─── openDay ─────────────────────────────────────────────
  describe('openDay', () => {
    it('refuses to overwrite a closed day', async () => {
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        closedAt: new Date(),
      });
      await expect(
        service.openDay(SCOPE, { openingCash: 100, date: new Date('2026-05-20') } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('upserts openingCash and triggers recompute', async () => {
      prisma.dailyIncome.findUnique
        .mockResolvedValueOnce(null) // initial check (not closed)
        .mockResolvedValue({ id: 'd1', openingCash: '500', closedAt: null }); // after upsert
      const txMock = {
        dailyIncome: {
          upsert: jest.fn().mockResolvedValue({ id: 'd1', openingCash: '500' }),
        },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      // recompute calls
      prisma.sale.groupBy.mockResolvedValue([]);
      prisma.customerTransaction.aggregate.mockResolvedValue({ _sum: { amount: '0' } });
      prisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: '0' } });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.dailyIncome.upsert.mockResolvedValue({ id: 'd1' });

      await service.openDay(SCOPE, { openingCash: 500, date: new Date('2026-05-20') } as any);

      expect(txMock.dailyIncome.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            openingCash: 500,
          }),
        }),
      );
    });
  });

  // ─── closeDay ────────────────────────────────────────────
  describe('closeDay', () => {
    it('refuses double-close', async () => {
      // Recompute findUnique → returns row with closedAt
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        openingCash: '0',
        closedAt: new Date(),
      });
      await expect(
        service.closeDay(SCOPE, { date: new Date('2026-05-20') } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('sets closedAt and closedById', async () => {
      // recompute path returns an open row
      prisma.dailyIncome.findUnique.mockResolvedValue({
        id: 'd1',
        openingCash: '100',
        closedAt: null,
      });
      prisma.sale.groupBy.mockResolvedValue([]);
      prisma.customerTransaction.aggregate.mockResolvedValue({ _sum: { amount: '0' } });
      prisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: '0' } });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.dailyIncome.upsert.mockResolvedValue({ id: 'd1' });
      const txMock = {
        dailyIncome: { update: jest.fn().mockResolvedValue({ id: 'd1', closedAt: new Date() }) },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.closeDay(SCOPE, { date: new Date('2026-05-20') } as any);

      expect(txMock.dailyIncome.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            closedAt: expect.any(Date),
            closedById: 'actor-1',
          }),
        }),
      );
    });
  });
});
