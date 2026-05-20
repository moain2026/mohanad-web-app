/**
 * NotificationTemplatesService — Phase 8 P8-1.
 *
 * Templates produce notification body strings by substituting {{placeholders}}.
 * System templates are seeded on first run; user can edit body but not delete
 * a system template.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type CreateTemplateInput,
  type ListTemplatesQuery,
  TEMPLATE_KEYS,
  type UpdateTemplateInput,
} from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

/** Default system templates seeded on first request. */
const SYSTEM_TEMPLATE_DEFAULTS = [
  {
    key: TEMPLATE_KEYS.MONTHLY_REMINDER,
    name: 'تذكير شهري بالدين',
    channel: 'WHATSAPP' as const,
    bodyTemplate:
      'السلام عليكم {{customer_name}}،\nمستحقاتك الحالية: {{balance}} {{currency}}.\nيمكنك السداد متى ما تيسر، وشكراً لتعاملك معنا.',
    placeholders: ['customer_name', 'balance', 'currency', 'store_name'],
  },
  {
    key: TEMPLATE_KEYS.DEBT_HIGH,
    name: 'تنبيه دين مرتفع',
    channel: 'INTERNAL' as const,
    bodyTemplate: 'العميل {{customer_name}} رصيده تجاوز {{threshold}} {{currency}}.',
    placeholders: ['customer_name', 'threshold', 'currency'],
  },
  {
    key: TEMPLATE_KEYS.CREDIT_LIMIT_EXCEEDED,
    name: 'تنبيه تجاوز سقف الائتمان',
    channel: 'INTERNAL' as const,
    bodyTemplate:
      'العميل {{customer_name}} تجاوز سقف الائتمان ({{limit}} {{currency}}). الرصيد الحالي: {{balance}}.',
    placeholders: ['customer_name', 'limit', 'balance', 'currency'],
  },
  {
    key: TEMPLATE_KEYS.GRACE_PERIOD_ENDING,
    name: 'تنبيه انتهاء فترة السماح',
    channel: 'INTERNAL' as const,
    bodyTemplate: 'فترة السماح للعميل {{customer_name}} تنتهي في {{date}}.',
    placeholders: ['customer_name', 'date'],
  },
  {
    key: TEMPLATE_KEYS.CUSTOMER_INACTIVE,
    name: 'تنبيه عميل غير نشط',
    channel: 'INTERNAL' as const,
    bodyTemplate: 'العميل {{customer_name}} لم يتعامل منذ {{days}} يوم.',
    placeholders: ['customer_name', 'days'],
  },
  {
    key: TEMPLATE_KEYS.LARGE_SALE_INTERNAL,
    name: 'تنبيه عملية بيع كبيرة',
    channel: 'INTERNAL' as const,
    bodyTemplate:
      'عملية بيع بقيمة {{amount}} {{currency}} للعميل {{customer_name}} بواسطة {{worker}}.',
    placeholders: ['amount', 'currency', 'customer_name', 'worker'],
  },
];

@Injectable()
export class NotificationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotently ensure all system templates exist for this store. */
  async ensureSystemTemplates(storeId: string, actorId: string) {
    for (const tpl of SYSTEM_TEMPLATE_DEFAULTS) {
      await this.prisma.notificationTemplate.upsert({
        where: { storeId_key: { storeId, key: tpl.key } },
        update: {},
        create: {
          storeId,
          key: tpl.key,
          name: tpl.name,
          channel: tpl.channel,
          bodyTemplate: tpl.bodyTemplate,
          placeholdersJson: tpl.placeholders,
          isActive: true,
          isSystem: true,
          createdById: actorId,
        },
      });
    }
  }

  // ─── List ─────────────────────────────────────────────────
  async list(scope: Scope, query: ListTemplatesQuery) {
    await this.ensureSystemTemplates(scope.storeId, scope.actorId);
    return this.prisma.notificationTemplate.findMany({
      where: {
        storeId: scope.storeId,
        ...(query.channel ? { channel: query.channel } : {}),
        ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
        updatedBy: { select: { id: true, username: true, fullName: true } },
      },
    });
  }

  async findOne(scope: Scope, id: string) {
    const t = await this.prisma.notificationTemplate.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!t) {
      throw new NotFoundException({
        message: 'القالب غير موجود',
        code: 'TEMPLATE_NOT_FOUND',
      });
    }
    return t;
  }

  // ─── Create ───────────────────────────────────────────────
  async create(scope: Scope, input: CreateTemplateInput) {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { storeId_key: { storeId: scope.storeId, key: input.key } },
    });
    if (existing) {
      throw new ConflictException({
        message: 'مفتاح القالب مستخدم مسبقاً',
        code: 'TEMPLATE_KEY_DUPLICATE',
      });
    }
    return this.prisma.$transaction(async (db) => {
      const created = await db.notificationTemplate.create({
        data: {
          storeId: scope.storeId,
          key: input.key,
          name: input.name,
          channel: input.channel,
          bodyTemplate: input.bodyTemplate,
          placeholdersJson: input.placeholders ?? [],
          isActive: input.isActive ?? true,
          isSystem: false,
          createdById: scope.actorId,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'create',
        entityType: 'notification_template',
        entityId: created.id,
        newValues: { key: input.key, name: input.name, channel: input.channel },
      });
      return created;
    });
  }

  // ─── Update ───────────────────────────────────────────────
  async update(scope: Scope, id: string, input: UpdateTemplateInput) {
    const before = await this.findOne(scope, id);
    return this.prisma.$transaction(async (db) => {
      const updated = await db.notificationTemplate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.channel !== undefined ? { channel: input.channel } : {}),
          ...(input.bodyTemplate !== undefined ? { bodyTemplate: input.bodyTemplate } : {}),
          ...(input.placeholders !== undefined ? { placeholdersJson: input.placeholders } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedById: scope.actorId,
        },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'update',
        entityType: 'notification_template',
        entityId: id,
        oldValues: { name: before.name, bodyTemplate: before.bodyTemplate },
        newValues: input as Record<string, unknown>,
      });
      return updated;
    });
  }

  // ─── Delete (non-system only) ────────────────────────────
  async delete(scope: Scope, id: string) {
    const t = await this.findOne(scope, id);
    if (t.isSystem) {
      throw new BadRequestException({
        message: 'لا يمكن حذف قالب نظامي — يمكنك تعطيله بدلاً من ذلك',
        code: 'TEMPLATE_SYSTEM_DELETE_FORBIDDEN',
      });
    }
    await this.prisma.$transaction(async (db) => {
      await db.notificationTemplate.delete({ where: { id } });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'delete',
        entityType: 'notification_template',
        entityId: id,
        oldValues: { key: t.key, name: t.name },
      });
    });
    return { ok: true };
  }

  // ─── Render template (used by NotificationsService later) ────
  static render(template: string, vars: Record<string, string | number | null | undefined>) {
    return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
      const v = vars[k];
      return v === undefined || v === null ? '' : String(v);
    });
  }
}
