/**
 * SuppliersService — Phase 4 P4-2.
 *
 * Mirrors `CustomersService` but with the inverted balance semantics
 * documented in `prisma/schema.prisma`:
 *   currentBalance > 0 → store OWES the supplier
 *   currentBalance = 0 → settled
 *   currentBalance < 0 → supplier owes the store (overpayment)
 *
 * Responsibilities:
 *   • CRUD on Suppliers scoped to caller's storeId.
 *   • Soft-delete via `deletedAt`.
 *   • Statement aggregation (current balance + paginated transactions).
 *   • Opening-balance ledger row created atomically when openingBalance != 0.
 *
 * Conventions:
 *   • All write paths use `prisma.$transaction(async (tx) => {...})`.
 *   • Audit-log rows are appended for every state-changing action.
 *   • Errors carry an Arabic `message` and a stable `code`.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateSupplierInput, ListSuppliersQuery, UpdateSupplierInput } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface SupplierScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List (paginated + search + filter) ───────────────────
  async list(scope: SupplierScope, query: ListSuppliersQuery) {
    const { page, limit, search, sortBy, sortDir, isActive, hasBalance } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(hasBalance ? { currentBalance: { not: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { whatsappPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const orderBy = sortBy ? { [sortBy]: sortDir } : { createdAt: sortDir };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappPhone: true,
          currentBalance: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Detail ────────────────────────────────────────────────
  async findOne(scope: SupplierScope, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!supplier) {
      throw new NotFoundException({
        message: 'المورّد غير موجود',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return supplier;
  }

  // ─── Balance only ─────────────────────────────────────────
  async getBalance(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        openingBalance: true,
        isActive: true,
      },
    });
    if (!s) {
      throw new NotFoundException({
        message: 'المورّد غير موجود',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return s;
  }

  // ─── Statement (balance + paginated tx) ───────────────────
  async statement(scope: SupplierScope, id: string, page = 1, limit = 50) {
    const supplier = await this.getBalance(scope, id);
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplierTransaction.findMany({
        where: { supplierId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.supplierTransaction.count({ where: { supplierId: id } }),
    ]);
    return {
      supplier,
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Create ────────────────────────────────────────────────
  async create(scope: SupplierScope, input: CreateSupplierInput) {
    const opening = Number(input.openingBalance ?? 0);

    const created = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          storeId: scope.storeId,
          name: input.name,
          phone: input.phone ?? null,
          whatsappPhone: input.whatsappPhone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          openingBalance: opening,
          currentBalance: opening,
          createdById: scope.actorId,
        },
      });
      // opening-balance ledger row when != 0
      if (opening !== 0) {
        await tx.supplierTransaction.create({
          data: {
            supplierId: supplier.id,
            type: 'OPENING',
            amount: opening,
            balanceBefore: 0,
            balanceAfter: opening,
            createdById: scope.actorId,
            notes: 'رصيد افتتاحي',
          },
        });
      }
      await writeAuditLog(tx, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'supplier',
        entityId: supplier.id,
        newValues: {
          name: supplier.name,
          openingBalance: opening,
        },
      });
      return supplier;
    });
    return this.findOne(scope, created.id);
  }

  // ─── Update ────────────────────────────────────────────────
  async update(scope: SupplierScope, id: string, input: UpdateSupplierInput) {
    const before = await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
          ...(input.whatsappPhone !== undefined
            ? { whatsappPhone: input.whatsappPhone ?? null }
            : {}),
          ...(input.address !== undefined ? { address: input.address ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        },
      });
      await writeAuditLog(tx, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'update',
        entityType: 'supplier',
        entityId: id,
        oldValues: { name: before.name, phone: before.phone },
        newValues: { ...input },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Soft delete ───────────────────────────────────────────
  async remove(scope: SupplierScope, id: string) {
    const before = await this.assertExists(scope, id);
    if (Number(before.currentBalance) !== 0) {
      throw new ConflictException({
        message: 'لا يمكن حذف مورّد لديه رصيد غير صفر',
        code: 'SUPPLIER_HAS_BALANCE',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await writeAuditLog(tx, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'delete',
        entityType: 'supplier',
        entityId: id,
      });
    });
    return { ok: true };
  }

  // ─── Restore (Owner only) ─────────────────────────────────
  async restore(scope: SupplierScope, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!supplier) {
      throw new NotFoundException({
        message: 'المورّد غير موجود',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    if (!supplier.deletedAt) {
      throw new BadRequestException({
        message: 'المورّد غير محذوف',
        code: 'SUPPLIER_NOT_DELETED',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });
      await writeAuditLog(tx, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'restore',
        entityType: 'supplier',
        entityId: id,
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Helper ────────────────────────────────────────────────
  private async assertExists(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
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
