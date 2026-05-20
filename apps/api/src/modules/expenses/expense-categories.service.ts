/**
 * ExpenseCategoriesService — Phase 5 P5-2.
 *
 * Per-store CRUD with soft-delete. Categories cannot be hard-deleted while
 * non-cancelled expenses reference them (we soft-delete + set isActive=false
 * to keep historical reports intact).
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type {
  CreateExpenseCategoryInput,
  ListExpenseCategoriesQuery,
  UpdateExpenseCategoryInput,
} from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: Scope, query: ListExpenseCategoriesQuery) {
    const { page, limit, search, sortDir, includeInactive } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenseCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: sortDir },
      }),
      this.prisma.expenseCategory.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(scope: Scope, id: string) {
    const cat = await this.prisma.expenseCategory.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
    });
    if (!cat) {
      throw new NotFoundException({
        message: 'فئة المصروف غير موجودة',
        code: 'EXPENSE_CATEGORY_NOT_FOUND',
      });
    }
    return cat;
  }

  async create(scope: Scope, input: CreateExpenseCategoryInput) {
    // Uniqueness check (storeId + name).
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { storeId: scope.storeId, name: input.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        message: 'اسم الفئة مستخدم مسبقاً',
        code: 'EXPENSE_CATEGORY_NAME_TAKEN',
      });
    }

    const created = await this.prisma.$transaction(async (db) => {
      const cat = await db.expenseCategory.create({
        data: {
          storeId: scope.storeId,
          name: input.name,
          description: input.description ?? null,
          createdById: scope.actorId,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'expense_category',
        entityId: cat.id,
        newValues: { name: input.name },
      });
      return cat;
    });
    return created;
  }

  async update(scope: Scope, id: string, input: UpdateExpenseCategoryInput) {
    await this.findOne(scope, id);

    // If renaming, enforce uniqueness on the new name.
    if (input.name) {
      const dup = await this.prisma.expenseCategory.findFirst({
        where: {
          storeId: scope.storeId,
          name: input.name,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (dup) {
        throw new ConflictException({
          message: 'اسم الفئة مستخدم مسبقاً',
          code: 'EXPENSE_CATEGORY_NAME_TAKEN',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (db) => {
      const cat = await db.expenseCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'update',
        entityType: 'expense_category',
        entityId: id,
        newValues: input,
      });
      return cat;
    });
    return updated;
  }

  async remove(scope: Scope, id: string) {
    await this.findOne(scope, id);

    // Soft-delete + deactivate to keep references but hide from pickers.
    const removed = await this.prisma.$transaction(async (db) => {
      const cat = await db.expenseCategory.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'delete',
        entityType: 'expense_category',
        entityId: id,
      });
      return cat;
    });
    return removed;
  }
}
