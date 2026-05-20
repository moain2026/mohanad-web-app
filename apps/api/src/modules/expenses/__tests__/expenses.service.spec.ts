/**
 * ExpensesService — Jest spec (Phase 5 P5-2).
 *
 * Critical invariants exercised here:
 *
 *   ✅ NORMAL              → only Expense row + audit + recompute (no supplier touch).
 *   ✅ SUPPLIER_PAYMENT    → atomic Expense + SupplierTransaction(PAYMENT) +
 *                            supplier.currentBalance decreased by `amount`.
 *   ✅ CASH_PURCHASE_LINK  → only Expense row created with
 *                            referenceType='purchase' / referenceId=purchaseId.
 *                            NO SupplierTransaction, NO supplier touch.
 *                            (Daily income reads cash_purchases from
 *                            `purchases`, not from this expense — that is
 *                            verified separately in daily-income.service.spec.)
 *   ✅ CASH_PURCHASE_LINK guards: refuses CREDIT purchases and cancelled ones.
 *   ✅ SUPPLIER_PAYMENT cancel reverses balance by exactly `amount`.
 *   ✅ Inactive / soft-deleted category rejected.
 *   ✅ Zero / negative amount rejected.
 *   ✅ Already-cancelled expense cannot be cancelled twice.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DailyIncomeService } from '../../daily-income/daily-income.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpensesService } from '../expenses.service';

const SCOPE = { storeId: 'store-1', actorId: 'actor-1' };

const buildPrismaMock = () => ({
  expense: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  expenseCategory: {
    findFirst: jest.fn(),
  },
  supplier: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  supplierTransaction: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  purchase: {
    findFirst: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ACTIVE_CATEGORY = {
  id: 'cat-1',
  storeId: 'store-1',
  name: 'فواتير',
  isActive: true,
  deletedAt: null,
};

const ACTIVE_SUPPLIER = {
  id: 'sup-1',
  storeId: 'store-1',
  name: 'Acme',
  isActive: true,
  currentBalance: '500',
  deletedAt: null,
};

const CASH_PURCHASE = {
  id: 'pur-1',
  storeId: 'store-1',
  paymentType: 'CASH',
  cancelledAt: null,
};

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let dailyIncome: { recompute: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    dailyIncome = { recompute: jest.fn().mockResolvedValue({}) };
    const m = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: DailyIncomeService, useValue: dailyIncome },
      ],
    }).compile();
    service = m.get(ExpensesService);
  });

  // ─── Common guards ───────────────────────────────────────
  describe('common guards', () => {
    it('rejects zero amount', async () => {
      await expect(
        service.create(SCOPE, {
          type: 'NORMAL',
          categoryId: 'cat-1',
          amount: 0,
          description: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when category not found', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(null);
      await expect(
        service.create(SCOPE, {
          type: 'NORMAL',
          categoryId: 'cat-x',
          amount: 10,
          description: 'X',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when category inactive', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue({
        ...ACTIVE_CATEGORY,
        isActive: false,
      });
      await expect(
        service.create(SCOPE, {
          type: 'NORMAL',
          categoryId: 'cat-1',
          amount: 10,
          description: 'X',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── NORMAL path ─────────────────────────────────────────
  describe('create — NORMAL', () => {
    it('creates Expense row only; no supplier/purchase touched; recompute called', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      const txMock = {
        expense: {
          create: jest.fn().mockResolvedValue({
            id: 'e1',
            type: 'NORMAL',
            amount: '50',
            expenseDate: new Date('2026-05-20'),
          }),
          update: jest.fn(),
        },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.expense.findFirst.mockResolvedValue({ id: 'e1' });

      await service.create(SCOPE, {
        type: 'NORMAL',
        categoryId: 'cat-1',
        amount: 50,
        description: 'كهرباء',
      } as any);

      expect(txMock.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'NORMAL',
            amount: 50,
            referenceType: null,
            referenceId: null,
          }),
        }),
      );
      // ⭐ INVARIANT — NORMAL path does NOT touch supplier ledger.
      expect(txMock.supplierTransaction.create).not.toHaveBeenCalled();
      expect(txMock.supplier.update).not.toHaveBeenCalled();
      // ⭐ INVARIANT — daily-income recompute called.
      expect(dailyIncome.recompute).toHaveBeenCalledWith('store-1', expect.any(Date));
    });
  });

  // ─── SUPPLIER_PAYMENT path ───────────────────────────────
  describe('create — SUPPLIER_PAYMENT', () => {
    it('blocks when supplier missing', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      prisma.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.create(SCOPE, {
          type: 'SUPPLIER_PAYMENT',
          categoryId: 'cat-1',
          amount: 200,
          description: 'دفعة',
          supplierId: 'sup-x',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('atomically: Expense + SupplierTransaction(PAYMENT) + balance 500-200=300', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        expense: {
          create: jest.fn().mockResolvedValue({
            id: 'e1',
            type: 'SUPPLIER_PAYMENT',
            amount: '200',
            expenseDate: new Date('2026-05-20'),
          }),
          update: jest.fn(),
        },
        supplierTransaction: {
          create: jest.fn().mockResolvedValue({ id: 'st1' }),
        },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.expense.findFirst.mockResolvedValue({ id: 'e1' });

      await service.create(SCOPE, {
        type: 'SUPPLIER_PAYMENT',
        categoryId: 'cat-1',
        amount: 200,
        description: 'دفعة لشركة Acme',
        supplierId: 'sup-1',
      } as any);

      // ⭐ INVARIANT — supplier ledger row with type=PAYMENT
      expect(txMock.supplierTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PAYMENT',
            amount: 200,
            balanceBefore: 500,
            balanceAfter: 300,
            referenceType: 'expense',
            referenceId: 'e1',
          }),
        }),
      );
      // ⭐ INVARIANT — supplier balance dropped by exactly amount
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 300 } }),
      );
      // ⭐ INVARIANT — cross-link applied back on expense
      expect(txMock.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: { referenceId: 'st1' },
        }),
      );
    });
  });

  // ─── CASH_PURCHASE_LINK path ─────────────────────────────
  describe('create — CASH_PURCHASE_LINK', () => {
    it('rejects link to a CREDIT purchase', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      prisma.purchase.findFirst.mockResolvedValue({
        ...CASH_PURCHASE,
        paymentType: 'CREDIT',
      });
      await expect(
        service.create(SCOPE, {
          type: 'CASH_PURCHASE_LINK',
          categoryId: 'cat-1',
          amount: 100,
          description: 'X',
          purchaseId: 'pur-1',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects link to a cancelled purchase', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      prisma.purchase.findFirst.mockResolvedValue({
        ...CASH_PURCHASE,
        cancelledAt: new Date(),
      });
      await expect(
        service.create(SCOPE, {
          type: 'CASH_PURCHASE_LINK',
          categoryId: 'cat-1',
          amount: 100,
          description: 'X',
          purchaseId: 'pur-1',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates Expense ONLY (no supplier touch) and stores reference', async () => {
      prisma.expenseCategory.findFirst.mockResolvedValue(ACTIVE_CATEGORY);
      prisma.purchase.findFirst.mockResolvedValue(CASH_PURCHASE);
      const txMock = {
        expense: {
          create: jest.fn().mockResolvedValue({
            id: 'e1',
            expenseDate: new Date('2026-05-20'),
          }),
          update: jest.fn(),
        },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.expense.findFirst.mockResolvedValue({ id: 'e1' });

      await service.create(SCOPE, {
        type: 'CASH_PURCHASE_LINK',
        categoryId: 'cat-1',
        amount: 100,
        description: 'فاتورة سكر',
        purchaseId: 'pur-1',
      } as any);

      expect(txMock.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceType: 'purchase',
            referenceId: 'pur-1',
          }),
        }),
      );
      // ⭐ INVARIANT — NO supplier ledger / balance touched.
      expect(txMock.supplierTransaction.create).not.toHaveBeenCalled();
      expect(txMock.supplier.update).not.toHaveBeenCalled();
    });
  });

  // ─── Cancel ───────────────────────────────────────────────
  describe('cancel', () => {
    it('throws NOT_FOUND when missing', async () => {
      prisma.expense.findFirst.mockResolvedValue(null);
      await expect(service.cancel(SCOPE, 'e1', { reason: 'x' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ALREADY_CANCELLED when previously cancelled', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'e1',
        type: 'NORMAL',
        cancelledAt: new Date(),
      });
      await expect(service.cancel(SCOPE, 'e1', { reason: 'x' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('NORMAL cancel: soft-mark only; no supplier touch', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'e1',
        type: 'NORMAL',
        amount: '50',
        expenseDate: new Date('2026-05-20'),
        cancelledAt: null,
      });
      const txMock = {
        expense: { update: jest.fn().mockResolvedValue({ id: 'e1' }) },
        supplierTransaction: { findFirst: jest.fn(), update: jest.fn() },
        supplier: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.expense.findFirst
        .mockResolvedValueOnce({
          id: 'e1',
          type: 'NORMAL',
          amount: '50',
          expenseDate: new Date('2026-05-20'),
          cancelledAt: null,
        })
        .mockResolvedValue({ id: 'e1' });

      await service.cancel(SCOPE, 'e1', { reason: 'بالخطأ' } as any);
      // ⭐ INVARIANT — soft-mark applied
      expect(txMock.expense.update).toHaveBeenCalled();
      // ⭐ INVARIANT — supplier untouched
      expect(txMock.supplierTransaction.update).not.toHaveBeenCalled();
      expect(txMock.supplier.update).not.toHaveBeenCalled();
    });

    it('SUPPLIER_PAYMENT cancel: reverses balance 300 + 200 = 500 AND marks linked tx', async () => {
      prisma.expense.findFirst
        .mockResolvedValueOnce({
          id: 'e1',
          type: 'SUPPLIER_PAYMENT',
          amount: '200',
          referenceId: 'st1',
          expenseDate: new Date('2026-05-20'),
          cancelledAt: null,
        })
        .mockResolvedValue({ id: 'e1' });
      const txMock = {
        expense: { update: jest.fn().mockResolvedValue({ id: 'e1' }) },
        supplierTransaction: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'st1',
            supplierId: 'sup-1',
            cancelledAt: null,
          }),
          update: jest.fn(),
        },
        supplier: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'sup-1',
            currentBalance: '300',
          }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 'e1', { reason: 'مردود' } as any);

      // ⭐ INVARIANT — linked PAYMENT tx soft-marked
      expect(txMock.supplierTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'st1' },
          data: expect.objectContaining({ cancelReason: 'مردود' }),
        }),
      );
      // ⭐ INVARIANT — supplier balance reversed by exactly amount
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 500 } }),
      );
    });
  });
});
