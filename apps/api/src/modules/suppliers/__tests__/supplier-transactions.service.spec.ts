/**
 * SupplierTransactionsService — Jest spec.
 *
 * Covers: list (filter/pagination), createPayment (atomic), createAdjustment
 * (signed), cancel (reverse balance for PAYMENT/ADJUSTMENT), guards for
 * OPENING / CREDIT_PURCHASE / already-cancelled rows.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { SupplierTransactionsService } from '../supplier-transactions.service';

const SCOPE = { storeId: 'store-1', actorId: 'actor-1' };

const buildPrismaMock = () => ({
  supplier: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  supplierTransaction: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ACTIVE_SUPPLIER = {
  id: 's1',
  storeId: 'store-1',
  name: 'Acme',
  isActive: true,
  currentBalance: '1000',
  deletedAt: null,
};

describe('SupplierTransactionsService', () => {
  let service: SupplierTransactionsService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const m = await Test.createTestingModule({
      providers: [SupplierTransactionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(SupplierTransactionsService);
  });

  // ─── list ─────────────────────────────────────────────────
  describe('list', () => {
    it('throws when supplier missing', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.list(SCOPE, 's1', {
          page: 1,
          limit: 20,
          sortDir: 'desc',
          includeCancelled: false,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('paginates and excludes cancelled by default', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.$transaction.mockResolvedValue([[{ id: 't1' }], 1]);
      const r = await service.list(SCOPE, 's1', {
        page: 1,
        limit: 20,
        sortDir: 'desc',
        includeCancelled: false,
      } as any);
      expect(r.meta.total).toBe(1);
    });
  });

  // ─── createPayment (DECREASES balance) ────────────────────
  describe('createPayment', () => {
    it('rejects negative or zero amount', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      await expect(service.createPayment(SCOPE, 's1', { amount: 0 } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createPayment(SCOPE, 's1', { amount: -10 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects payment to inactive supplier', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ ...ACTIVE_SUPPLIER, isActive: false });
      await expect(service.createPayment(SCOPE, 's1', { amount: 100 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('decreases balance atomically: 1000 - 300 = 700', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        supplierTransaction: {
          create: jest.fn().mockResolvedValue({ id: 't1', type: 'PAYMENT' }),
        },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const r = await service.createPayment(SCOPE, 's1', { amount: 300 } as any);
      expect(r.id).toBe('t1');
      expect(txMock.supplierTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PAYMENT',
            amount: 300,
            balanceBefore: 1000,
            balanceAfter: 700,
          }),
        }),
      );
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 700 } }),
      );
    });
  });

  // ─── createAdjustment (signed) ────────────────────────────
  describe('createAdjustment', () => {
    it('rejects zero amount', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      await expect(
        service.createAdjustment(SCOPE, 's1', { amount: 0, notes: 'x' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies positive adjustment: 1000 + 200 = 1200', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        supplierTransaction: { create: jest.fn().mockResolvedValue({ id: 't2' }) },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.createAdjustment(SCOPE, 's1', {
        amount: 200,
        notes: 'تسوية موجبة',
      } as any);
      expect(txMock.supplierTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT',
            amount: 200,
            balanceBefore: 1000,
            balanceAfter: 1200,
          }),
        }),
      );
    });

    it('applies negative adjustment: 1000 + (-150) = 850', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        supplierTransaction: { create: jest.fn().mockResolvedValue({ id: 't3' }) },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.createAdjustment(SCOPE, 's1', {
        amount: -150,
        notes: 'تسوية سالبة',
      } as any);
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 850 } }),
      );
    });
  });

  // ─── cancel ───────────────────────────────────────────────
  describe('cancel', () => {
    it('throws TX_NOT_FOUND when missing', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue(null);
      await expect(service.cancel(SCOPE, 's1', 'tx-x', { reason: 'r' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws TX_ALREADY_CANCELLED when already cancelled', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue({
        id: 't1',
        type: 'PAYMENT',
        amount: '100',
        cancelledAt: new Date(),
      });
      await expect(service.cancel(SCOPE, 's1', 't1', { reason: 'r' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('blocks cancelling OPENING rows', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue({
        id: 't1',
        type: 'OPENING',
        amount: '500',
        cancelledAt: null,
      });
      await expect(service.cancel(SCOPE, 's1', 't1', { reason: 'r' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('redirects CREDIT_PURCHASE cancel to the purchase endpoint', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue({
        id: 't1',
        type: 'CREDIT_PURCHASE',
        amount: '500',
        cancelledAt: null,
      });
      await expect(service.cancel(SCOPE, 's1', 't1', { reason: 'r' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('reverses PAYMENT: 1000 + 300 = 1300', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue({
        id: 't1',
        type: 'PAYMENT',
        amount: '300',
        cancelledAt: null,
      });
      const txMock = {
        supplier: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ACTIVE_SUPPLIER }),
          update: jest.fn(),
        },
        supplierTransaction: { update: jest.fn().mockResolvedValue({ id: 't1' }) },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const r = await service.cancel(SCOPE, 's1', 't1', { reason: 'تم بالخطأ' } as any);
      expect(r.newBalance).toBe(1300);
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 1300 } }),
      );
    });

    it('reverses ADJUSTMENT (signed): 1000 - 200 = 800', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      prisma.supplierTransaction.findFirst.mockResolvedValue({
        id: 't2',
        type: 'ADJUSTMENT',
        amount: '200', // positive adjustment → reverse subtracts 200
        cancelledAt: null,
      });
      const txMock = {
        supplier: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ACTIVE_SUPPLIER }),
          update: jest.fn(),
        },
        supplierTransaction: { update: jest.fn().mockResolvedValue({ id: 't2' }) },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const r = await service.cancel(SCOPE, 's1', 't2', { reason: 'تصحيح' } as any);
      expect(r.newBalance).toBe(800);
    });
  });
});
