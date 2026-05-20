/**
 * ProductsService — Phase 9 P9-1.
 *
 * Inventory is OPTIONAL — gated by Setting{key:"inventory.enabled"} = true.
 * When disabled, the service still works (CRUD remains available for admins
 * to pre-load data), but Sale/Purchase hooks skip stock decrements.
 *
 * `currentStock` is the source of truth (denormalised from StockMovement
 * for fast reads). Every mutation goes through prisma.$transaction with
 * row-locking semantics — same pattern as Customer.currentBalance.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ─────────────────────────────────────────────────
  async list(scope: Scope, query: ListProductsQuery) {
    const { page, limit, search, sortDir, sortBy, category, lowStockOnly, includeArchived } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(includeArchived ? {} : { deletedAt: null }),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let lowStockFilter: Record<string, unknown> = {};
    if (lowStockOnly) {
      // We post-filter after fetching since Prisma can't compare two columns.
      lowStockFilter = {};
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortBy === 'name' || sortBy === 'currentStock' || sortBy === 'sellPrice') {
      orderBy[sortBy] = sortDir;
    } else {
      orderBy.createdAt = sortDir;
    }

    const [itemsRaw, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { ...where, ...lowStockFilter },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where: { ...where, ...lowStockFilter } }),
    ]);

    const items = lowStockOnly
      ? itemsRaw.filter((p) => Number(p.currentStock) <= Number(p.reorderLevel))
      : itemsRaw;

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(scope: Scope, id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!p) {
      throw new NotFoundException({
        message: 'المنتج غير موجود',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return p;
  }

  // ─── Create ───────────────────────────────────────────────
  async create(scope: Scope, input: CreateProductInput) {
    if (input.sku) {
      const dup = await this.prisma.product.findFirst({
        where: { storeId: scope.storeId, sku: input.sku, deletedAt: null },
      });
      if (dup) {
        throw new ConflictException({
          message: 'الرمز (SKU) مستخدم لمنتج آخر',
          code: 'PRODUCT_SKU_DUPLICATE',
        });
      }
    }

    return this.prisma.$transaction(async (db) => {
      const openingStock = Number(input.openingStock ?? 0);
      const created = await db.product.create({
        data: {
          storeId: scope.storeId,
          sku: input.sku ?? null,
          name: input.name,
          unit: input.unit ?? 'piece',
          category: input.category ?? null,
          reorderLevel: Number(input.reorderLevel ?? 0),
          costPrice: Number(input.costPrice ?? 0),
          sellPrice: Number(input.sellPrice ?? 0),
          currentStock: openingStock,
          createdById: scope.actorId,
        },
      });

      // Record opening-stock as a movement so the ledger stays complete.
      if (openingStock > 0) {
        await db.stockMovement.create({
          data: {
            storeId: scope.storeId,
            productId: created.id,
            type: 'IN',
            quantity: openingStock,
            stockBefore: 0,
            stockAfter: openingStock,
            notes: 'رصيد افتتاحي',
            referenceType: 'opening',
            createdById: scope.actorId,
          },
        });
      }

      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'product',
        entityId: created.id,
        newValues: { name: input.name, sku: input.sku, openingStock },
      });

      return created;
    });
  }

  // ─── Update ──────────────────────────────────────────────
  async update(scope: Scope, id: string, input: UpdateProductInput) {
    const before = await this.findOne(scope, id);

    if (input.sku && input.sku !== before.sku) {
      const dup = await this.prisma.product.findFirst({
        where: {
          storeId: scope.storeId,
          sku: input.sku,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (dup) {
        throw new ConflictException({
          message: 'الرمز (SKU) مستخدم لمنتج آخر',
          code: 'PRODUCT_SKU_DUPLICATE',
        });
      }
    }

    return this.prisma.$transaction(async (db) => {
      const updated = await db.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.reorderLevel !== undefined ? { reorderLevel: Number(input.reorderLevel) } : {}),
          ...(input.costPrice !== undefined ? { costPrice: Number(input.costPrice) } : {}),
          ...(input.sellPrice !== undefined ? { sellPrice: Number(input.sellPrice) } : {}),
          updatedById: scope.actorId,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'update',
        entityType: 'product',
        entityId: id,
        oldValues: { name: before.name, sellPrice: before.sellPrice },
        newValues: input as Record<string, unknown>,
      });
      return updated;
    });
  }

  // ─── Soft delete ─────────────────────────────────────────
  async archive(scope: Scope, id: string) {
    const before = await this.findOne(scope, id);
    if (before.deletedAt) {
      throw new ConflictException({
        message: 'المنتج مؤرشف مسبقاً',
        code: 'PRODUCT_ALREADY_ARCHIVED',
      });
    }
    await this.prisma.$transaction(async (db) => {
      await db.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'delete',
        entityType: 'product',
        entityId: id,
        oldValues: { name: before.name },
      });
    });
    return { ok: true };
  }

  async restore(scope: Scope, id: string) {
    const before = await this.findOne(scope, id);
    if (!before.deletedAt) {
      throw new BadRequestException({
        message: 'المنتج غير مؤرشف',
        code: 'PRODUCT_NOT_ARCHIVED',
      });
    }
    return this.prisma.$transaction(async (db) => {
      const updated = await db.product.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'restore',
        entityType: 'product',
        entityId: id,
      });
      return updated;
    });
  }

  // ─── Stock summary (used by /inventory dashboard) ────────
  async stockSummary(scope: Scope) {
    const [total, active, archived, lowStock] = await Promise.all([
      this.prisma.product.count({ where: { storeId: scope.storeId } }),
      this.prisma.product.count({
        where: { storeId: scope.storeId, deletedAt: null, isActive: true },
      }),
      this.prisma.product.count({
        where: { storeId: scope.storeId, deletedAt: { not: null } },
      }),
      this.prisma.product.findMany({
        where: { storeId: scope.storeId, deletedAt: null, isActive: true },
        select: {
          id: true,
          name: true,
          currentStock: true,
          reorderLevel: true,
          unit: true,
        },
      }),
    ]);
    const lowStockItems = lowStock.filter((p) => Number(p.currentStock) <= Number(p.reorderLevel));
    return {
      total,
      active,
      archived,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 20),
    };
  }
}
