/**
 * SalesService — Jest spec (Phase 6 P6-2).
 *
 * Critical invariants exercised here:
 *
 *   ✅ QUICK     → Sale row only, no customer/items.
 *   ✅ DETAILED  → Sale row + SaleItem rows + hasItems=true.
 *   ✅ CREDIT    → atomic Sale + CustomerTransaction(DEBT) + Customer.balance up.
 *   ✅ CREDIT to FROZEN customer → blocked.
 *   ✅ CREDIT over the limit without permission → CREDIT_LIMIT_EXCEEDED.
 *   ✅ CREDIT over the limit WITH approve permission → proceeds.
 *   ✅ Cancel CREDIT reverses balance + soft-marks linked customer tx.
 *   ✅ Cancel QUICK/DETAILED touches only the sale row (no customer).
 *   ✅ Already-cancelled sale rejects re-cancel.
 *   ✅ daily-income.recompute called after every successful mutation.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DailyIncomeService } from '../../daily-income/daily-income.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesService } from '../sales.service';

const SCOPE = {
  storeId: 'store-1',
  actorId: 'actor-1',
  permissions: ['sales.create'],
};
const SCOPE_APPROVE = {
  ...SCOPE,
  permissions: [...SCOPE.permissions, 'customer_transactions.approve_over_limit'],
};

const buildPrismaMock = () => ({
  sale: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  saleItem: { createMany: jest.fn() },
  customer: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  customerTransaction: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ACTIVE_CUSTOMER = {
  id: 'cus-1',
  storeId: 'store-1',
  name: 'سامي',
  status: 'ACTIVE',
  currentBalance: '200',
  creditLimit: '1000',
  deletedAt: null,
};

describe('SalesService', () => {
  let service: SalesService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let dailyIncome: { recompute: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    dailyIncome = { recompute: jest.fn().mockResolvedValue({}) };
    const m = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        { provide: DailyIncomeService, useValue: dailyIncome },
      ],
    }).compile();
    service = m.get(SalesService);
  });

  // ─── Common guards ───────────────────────────────────────
  it('rejects zero amount', async () => {
    await expect(service.create(SCOPE, { mode: 'QUICK', totalAmount: 0 } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ─── QUICK path ──────────────────────────────────────────
  describe('create — QUICK', () => {
    it('creates Sale row only; no customer/items touched; recompute called', async () => {
      const txMock = {
        sale: { create: jest.fn().mockResolvedValue({ id: 's1', mode: 'QUICK', hasItems: false }) },
        saleItem: { createMany: jest.fn() },
        customerTransaction: { create: jest.fn() },
        customer: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.sale.findFirst.mockResolvedValue({ id: 's1', items: [] });

      await service.create(SCOPE, { mode: 'QUICK', totalAmount: 100 } as any);

      expect(txMock.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mode: 'QUICK',
            totalAmount: 100,
            hasItems: false,
            customerId: null,
          }),
        }),
      );
      expect(txMock.saleItem.createMany).not.toHaveBeenCalled();
      expect(txMock.customerTransaction.create).not.toHaveBeenCalled();
      expect(txMock.customer.update).not.toHaveBeenCalled();
      expect(dailyIncome.recompute).toHaveBeenCalledWith('store-1', expect.any(Date));
    });
  });

  // ─── DETAILED path ───────────────────────────────────────
  describe('create — DETAILED', () => {
    it('persists items + hasItems=true; no customer touch', async () => {
      const txMock = {
        sale: {
          create: jest.fn().mockResolvedValue({ id: 's1', mode: 'DETAILED', hasItems: true }),
        },
        saleItem: { createMany: jest.fn() },
        customerTransaction: { create: jest.fn() },
        customer: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.sale.findFirst.mockResolvedValue({ id: 's1', items: [] });

      await service.create(SCOPE, {
        mode: 'DETAILED',
        totalAmount: 50,
        items: [{ name: 'خبز', quantity: 5, unitPrice: 10, totalPrice: 50 }],
      } as any);

      expect(txMock.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hasItems: true }),
        }),
      );
      expect(txMock.saleItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ name: 'خبز', productId: null })]),
        }),
      );
      expect(txMock.customerTransaction.create).not.toHaveBeenCalled();
    });
  });

  // ─── CREDIT path ─────────────────────────────────────────
  describe('create — CREDIT', () => {
    it('blocks when customer missing', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(
        service.create(SCOPE, {
          mode: 'CREDIT',
          customerId: 'cus-x',
          totalAmount: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks FROZEN customer', async () => {
      prisma.customer.findFirst.mockResolvedValue({ ...ACTIVE_CUSTOMER, status: 'FROZEN' });
      await expect(
        service.create(SCOPE, {
          mode: 'CREDIT',
          customerId: 'cus-1',
          totalAmount: 100,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws CREDIT_LIMIT_EXCEEDED when over limit without approve permission', async () => {
      prisma.customer.findFirst.mockResolvedValue(ACTIVE_CUSTOMER);
      // 200 + 900 = 1100 > 1000
      await expect(
        service.create(SCOPE, {
          mode: 'CREDIT',
          customerId: 'cus-1',
          totalAmount: 900,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('proceeds over the limit when actor holds approve_over_limit', async () => {
      prisma.customer.findFirst.mockResolvedValue(ACTIVE_CUSTOMER);
      const txMock = {
        sale: { create: jest.fn().mockResolvedValue({ id: 's1', mode: 'CREDIT' }) },
        saleItem: { createMany: jest.fn() },
        customerTransaction: { create: jest.fn() },
        customer: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.sale.findFirst.mockResolvedValue({ id: 's1', items: [] });

      await service.create(SCOPE_APPROVE, {
        mode: 'CREDIT',
        customerId: 'cus-1',
        totalAmount: 900,
      } as any);
      expect(txMock.sale.create).toHaveBeenCalled();
    });

    it('atomically creates Sale + CustomerTransaction(DEBT) + bumps balance 200 + 300 = 500', async () => {
      prisma.customer.findFirst.mockResolvedValue(ACTIVE_CUSTOMER);
      const txMock = {
        sale: {
          create: jest.fn().mockResolvedValue({
            id: 's1',
            mode: 'CREDIT',
            totalAmount: '300',
          }),
        },
        saleItem: { createMany: jest.fn() },
        customerTransaction: { create: jest.fn() },
        customer: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.sale.findFirst.mockResolvedValue({ id: 's1', items: [] });

      await service.create(SCOPE, {
        mode: 'CREDIT',
        customerId: 'cus-1',
        totalAmount: 300,
      } as any);

      // ⭐ INVARIANT — DEBT row with reference back to sale
      expect(txMock.customerTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEBT',
            amount: 300,
            balanceBefore: 200,
            balanceAfter: 500,
            referenceType: 'sale',
            referenceId: 's1',
          }),
        }),
      );
      // ⭐ INVARIANT — customer balance bumped
      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 500 } }),
      );
    });
  });

  // ─── Cancel ───────────────────────────────────────────────
  describe('cancel', () => {
    it('throws NOT_FOUND when missing', async () => {
      prisma.sale.findFirst.mockResolvedValue(null);
      await expect(service.cancel(SCOPE, 's1', { reason: 'r' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ALREADY_CANCELLED when previously cancelled', async () => {
      prisma.sale.findFirst.mockResolvedValue({ id: 's1', cancelledAt: new Date() });
      await expect(service.cancel(SCOPE, 's1', { reason: 'r' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('QUICK cancel: soft-mark only; no customer touch', async () => {
      prisma.sale.findFirst
        .mockResolvedValueOnce({
          id: 's1',
          mode: 'QUICK',
          totalAmount: '100',
          customerId: null,
          createdAt: new Date(),
          cancelledAt: null,
        })
        .mockResolvedValue({ id: 's1' });
      const txMock = {
        sale: { update: jest.fn().mockResolvedValue({ id: 's1' }) },
        customerTransaction: { findFirst: jest.fn(), update: jest.fn() },
        customer: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 's1', { reason: 'x' } as any);
      expect(txMock.sale.update).toHaveBeenCalled();
      expect(txMock.customerTransaction.findFirst).not.toHaveBeenCalled();
      expect(txMock.customer.update).not.toHaveBeenCalled();
    });

    it('CREDIT cancel: reverses balance 500 − 300 = 200 AND soft-marks linked DEBT', async () => {
      prisma.sale.findFirst
        .mockResolvedValueOnce({
          id: 's1',
          mode: 'CREDIT',
          customerId: 'cus-1',
          totalAmount: '300',
          createdAt: new Date(),
          cancelledAt: null,
        })
        .mockResolvedValue({ id: 's1' });
      const txMock = {
        sale: { update: jest.fn().mockResolvedValue({ id: 's1' }) },
        customerTransaction: {
          findFirst: jest.fn().mockResolvedValue({ id: 'ct1' }),
          update: jest.fn(),
        },
        customer: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'cus-1',
            currentBalance: '500',
          }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 's1', { reason: 'مردود' } as any);

      // ⭐ INVARIANT — DEBT tx soft-marked
      expect(txMock.customerTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ct1' },
          data: expect.objectContaining({ cancelReason: 'مردود' }),
        }),
      );
      // ⭐ INVARIANT — balance reversed by exactly amount
      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 200 } }),
      );
    });
  });
});
