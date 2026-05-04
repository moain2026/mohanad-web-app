/**
 * PurchasesService — Jest spec.
 *
 * The Phase-4 invariants live here. Critical assertions:
 *
 *   ✅ CASH purchase  → supplier.update is NOT called (NO balance change).
 *   ✅ CREDIT purchase → supplier.currentBalance increases by totalAmount,
 *                        AND a SupplierTransaction(CREDIT_PURCHASE) row is
 *                        created with referenceType='purchase'.
 *   ✅ Cancel CREDIT  → supplier.currentBalance decreases by the original
 *                        totalAmount AND the linked tx is soft-marked.
 *   ✅ Cancel CASH    → supplier balance untouched.
 *   ✅ Inactive supplier → CREDIT blocked, CASH allowed (per service rule
 *                          — `isActive` check applies only to CREDIT).
 *   ✅ Soft-deleted supplier → both CASH and CREDIT blocked.
 *   ✅ Already-cancelled purchase cannot be cancelled again.
 *   ✅ Items persisted as PurchaseItem rows when provided; hasItems=true.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { PurchasesService } from '../purchases.service';

const SCOPE = { storeId: 'store-1', actorId: 'actor-1' };

const buildPrismaMock = () => ({
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
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  purchaseItem: {
    createMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ACTIVE_SUPPLIER = {
  id: 'sup-1',
  storeId: 'store-1',
  name: 'Acme',
  isActive: true,
  currentBalance: '500',
  deletedAt: null,
};

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const m = await Test.createTestingModule({
      providers: [PurchasesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(PurchasesService);
  });

  // ─── list ─────────────────────────────────────────────────
  describe('list', () => {
    it('paginates with filters', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: 'p1' }], 1]);
      const r = await service.list(SCOPE, {
        page: 1,
        limit: 20,
        sortDir: 'desc',
        includeCancelled: false,
      } as any);
      expect(r.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  // ─── findOne ─────────────────────────────────────────────
  describe('findOne', () => {
    it('throws PURCHASE_NOT_FOUND when none', async () => {
      prisma.purchase.findFirst.mockResolvedValue(null);
      await expect(service.findOne(SCOPE, 'p1')).rejects.toThrow(NotFoundException);
    });

    it('returns the purchase with items', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'p1',
        items: [{ id: 'i1', name: 'X' }],
      });
      const r = await service.findOne(SCOPE, 'p1');
      expect(r.items).toHaveLength(1);
    });
  });

  // ─── CASH path: NO balance change ─────────────────────────
  describe('create — CASH', () => {
    it('throws SUPPLIER_NOT_FOUND when supplier missing', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.create(SCOPE, {
          supplierId: 'sup-1',
          paymentType: 'CASH',
          totalAmount: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects zero or negative totalAmount', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      await expect(
        service.create(SCOPE, {
          supplierId: 'sup-1',
          paymentType: 'CASH',
          totalAmount: 0,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a Purchase row WITHOUT touching supplier balance', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        purchase: {
          create: jest.fn().mockResolvedValue({
            id: 'p1',
            paymentType: 'CASH',
            totalAmount: '100',
            hasItems: false,
          }),
        },
        purchaseItem: { createMany: jest.fn() },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      // findOne after create
      prisma.purchase.findFirst.mockResolvedValue({ id: 'p1', items: [] });

      await service.create(SCOPE, {
        supplierId: 'sup-1',
        paymentType: 'CASH',
        totalAmount: 100,
      } as any);

      // ⭐ CRITICAL INVARIANT — CASH path must NOT call these:
      expect(txMock.supplierTransaction.create).not.toHaveBeenCalled();
      expect(txMock.supplier.update).not.toHaveBeenCalled();
      // Purchase row must be created
      expect(txMock.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentType: 'CASH',
            totalAmount: 100,
          }),
        }),
      );
    });

    it('allows CASH purchase even when supplier is inactive', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ ...ACTIVE_SUPPLIER, isActive: false });
      const txMock = {
        purchase: {
          create: jest.fn().mockResolvedValue({ id: 'p1', hasItems: false }),
        },
        purchaseItem: { createMany: jest.fn() },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.purchase.findFirst.mockResolvedValue({ id: 'p1', items: [] });

      await service.create(SCOPE, {
        supplierId: 'sup-1',
        paymentType: 'CASH',
        totalAmount: 50,
      } as any);
      expect(txMock.purchase.create).toHaveBeenCalled();
    });

    it('persists items + hasItems=true when items provided', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        purchase: {
          create: jest.fn().mockResolvedValue({ id: 'p1', hasItems: true }),
        },
        purchaseItem: { createMany: jest.fn() },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.purchase.findFirst.mockResolvedValue({ id: 'p1', items: [] });

      await service.create(SCOPE, {
        supplierId: 'sup-1',
        paymentType: 'CASH',
        totalAmount: 200,
        items: [{ name: 'سكر', quantity: 2, unitCost: 100, totalCost: 200 }],
      } as any);

      expect(txMock.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ hasItems: true }) }),
      );
      expect(txMock.purchaseItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ name: 'سكر', productId: null })]),
        }),
      );
    });
  });

  // ─── CREDIT path: ATOMIC balance change ───────────────────
  describe('create — CREDIT', () => {
    it('blocks CREDIT to inactive supplier', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ ...ACTIVE_SUPPLIER, isActive: false });
      await expect(
        service.create(SCOPE, {
          supplierId: 'sup-1',
          paymentType: 'CREDIT',
          totalAmount: 200,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks CREDIT to soft-deleted supplier (via NOT_FOUND)', async () => {
      // assertSupplier filters deletedAt: null, so soft-deleted → null returned
      prisma.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.create(SCOPE, {
          supplierId: 'sup-1',
          paymentType: 'CREDIT',
          totalAmount: 200,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('atomically creates Purchase + SupplierTransaction(CREDIT_PURCHASE) + bumps balance: 500 + 800 = 1300', async () => {
      prisma.supplier.findFirst.mockResolvedValue(ACTIVE_SUPPLIER);
      const txMock = {
        purchase: {
          create: jest.fn().mockResolvedValue({
            id: 'p1',
            paymentType: 'CREDIT',
            totalAmount: '800',
            hasItems: false,
          }),
        },
        purchaseItem: { createMany: jest.fn() },
        supplierTransaction: { create: jest.fn() },
        supplier: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));
      prisma.purchase.findFirst.mockResolvedValue({ id: 'p1', items: [] });

      await service.create(SCOPE, {
        supplierId: 'sup-1',
        paymentType: 'CREDIT',
        totalAmount: 800,
        notes: 'فاتورة سكر',
      } as any);

      // ⭐ CRITICAL INVARIANT 1 — Purchase row created
      expect(txMock.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentType: 'CREDIT',
            totalAmount: 800,
          }),
        }),
      );

      // ⭐ CRITICAL INVARIANT 2 — SupplierTransaction(CREDIT_PURCHASE) row
      expect(txMock.supplierTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CREDIT_PURCHASE',
            amount: 800,
            balanceBefore: 500,
            balanceAfter: 1300,
            referenceType: 'purchase',
            referenceId: 'p1',
          }),
        }),
      );

      // ⭐ CRITICAL INVARIANT 3 — supplier.currentBalance bumped
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentBalance: 1300 },
        }),
      );
    });
  });

  // ─── Cancel ───────────────────────────────────────────────
  describe('cancel', () => {
    it('throws PURCHASE_NOT_FOUND when missing', async () => {
      prisma.purchase.findFirst.mockResolvedValue(null);
      await expect(service.cancel(SCOPE, 'p1', { reason: 'r' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws PURCHASE_ALREADY_CANCELLED when already cancelled', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'p1',
        paymentType: 'CASH',
        totalAmount: '100',
        cancelledAt: new Date(),
      });
      await expect(service.cancel(SCOPE, 'p1', { reason: 'r' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('CASH cancel: soft-marks the row but does NOT touch supplier balance', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'p1',
        supplierId: 'sup-1',
        paymentType: 'CASH',
        totalAmount: '100',
        cancelledAt: null,
      });
      const txMock = {
        purchase: { update: jest.fn().mockResolvedValue({ id: 'p1' }) },
        supplierTransaction: { findFirst: jest.fn(), update: jest.fn() },
        supplier: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 'p1', { reason: 'بالخطأ' } as any);
      expect(txMock.purchase.update).toHaveBeenCalled();

      // ⭐ CRITICAL INVARIANT — CASH cancel does NOT touch supplier
      expect(txMock.supplierTransaction.findFirst).not.toHaveBeenCalled();
      expect(txMock.supplierTransaction.update).not.toHaveBeenCalled();
      expect(txMock.supplier.update).not.toHaveBeenCalled();
    });

    it('CREDIT cancel: reverses balance 1300 - 800 = 500 AND marks linked tx', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'p1',
        supplierId: 'sup-1',
        paymentType: 'CREDIT',
        totalAmount: '800',
        cancelledAt: null,
      });
      const txMock = {
        purchase: { update: jest.fn().mockResolvedValue({ id: 'p1' }) },
        supplierTransaction: {
          findFirst: jest.fn().mockResolvedValue({ id: 'st1' }),
          update: jest.fn(),
        },
        supplier: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'sup-1',
            currentBalance: '1300',
          }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 'p1', { reason: 'مردود' } as any);

      // ⭐ INVARIANT — linked CREDIT_PURCHASE tx soft-marked
      expect(txMock.supplierTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'st1' },
          data: expect.objectContaining({ cancelReason: 'مردود' }),
        }),
      );

      // ⭐ INVARIANT — supplier balance reversed by exactly totalAmount
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 500 } }),
      );
    });

    it('CREDIT cancel without a linked tx still reverses the balance (defensive)', async () => {
      prisma.purchase.findFirst.mockResolvedValue({
        id: 'p1',
        supplierId: 'sup-1',
        paymentType: 'CREDIT',
        totalAmount: '500',
        cancelledAt: null,
      });
      const txMock = {
        purchase: { update: jest.fn().mockResolvedValue({ id: 'p1' }) },
        supplierTransaction: {
          findFirst: jest.fn().mockResolvedValue(null), // not found (data drift)
          update: jest.fn(),
        },
        supplier: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'sup-1',
            currentBalance: '500',
          }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.cancel(SCOPE, 'p1', { reason: 'r' } as any);
      expect(txMock.supplierTransaction.update).not.toHaveBeenCalled();
      expect(txMock.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentBalance: 0 } }),
      );
    });
  });
});
