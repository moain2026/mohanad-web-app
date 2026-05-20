/**
 * SettingsService — Phase 7 P7-1.
 *
 * Generic key/value settings store backed by the `Setting` Prisma model.
 * Each setting key has a typed Zod schema in `@grocery/shared/schemas/settings`.
 * Values are stored as JSON and validated against the per-key schema in
 * `upsert()`. Unknown keys are rejected.
 *
 * Get-many returns ALL known settings merged with defaults so the UI always
 * sees a complete settings dictionary even on a fresh install.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  DEFAULT_STORE_SETTINGS,
  SETTING_KEYS,
  type UpsertManySettingsInput,
  type UpsertSettingInput,
  settingValueByKey,
} from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { PrismaService } from '../prisma/prisma.service';

interface Scope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get all settings (defaults merged) ───────────────────
  async getAll(scope: Scope): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany({
      where: { storeId: scope.storeId },
    });
    const map: Record<string, unknown> = { ...DEFAULT_STORE_SETTINGS };
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  // ─── Get one ──────────────────────────────────────────────
  async getOne(scope: Scope, key: string): Promise<unknown> {
    if (!(key in settingValueByKey)) {
      throw new NotFoundException({
        message: `إعداد غير معروف: ${key}`,
        code: 'SETTING_UNKNOWN',
      });
    }
    const row = await this.prisma.setting.findUnique({
      where: { storeId_key: { storeId: scope.storeId, key } },
    });
    return row?.value ?? DEFAULT_STORE_SETTINGS[key];
  }

  // ─── Upsert one ──────────────────────────────────────────
  async upsert(scope: Scope, input: UpsertSettingInput): Promise<unknown> {
    const value = this.validate(input.key, input.value);
    const old = await this.prisma.setting.findUnique({
      where: { storeId_key: { storeId: scope.storeId, key: input.key } },
    });

    const updated = await this.prisma.$transaction(async (db) => {
      const row = await db.setting.upsert({
        where: { storeId_key: { storeId: scope.storeId, key: input.key } },
        update: { value: value as never },
        create: { storeId: scope.storeId, key: input.key, value: value as never },
      });
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'settings_change',
        entityType: 'setting',
        entityId: row.id,
        oldValues: old ? { value: old.value as unknown } : null,
        newValues: { key: input.key, value: value as unknown },
      });
      return row;
    });

    return updated.value;
  }

  // ─── Upsert many (used by /settings save-all) ────────────
  async upsertMany(scope: Scope, input: UpsertManySettingsInput): Promise<Record<string, unknown>> {
    for (const item of input.items) {
      // Pre-validate all before mutating any.
      this.validate(item.key, item.value);
    }
    await this.prisma.$transaction(async (db) => {
      for (const item of input.items) {
        const value = this.validate(item.key, item.value);
        await db.setting.upsert({
          where: { storeId_key: { storeId: scope.storeId, key: item.key } },
          update: { value: value as never },
          create: { storeId: scope.storeId, key: item.key, value: value as never },
        });
      }
      await writeAuditLog(db, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        action: 'settings_change',
        entityType: 'setting',
        entityId: null,
        newValues: { batch: input.items.map((i) => i.key) },
      });
    });
    return this.getAll(scope);
  }

  // ─── Internal: validate value against typed schema ───────
  private validate(key: string, raw: unknown): unknown {
    const schema = settingValueByKey[key];
    if (!schema) {
      throw new BadRequestException({
        message: `إعداد غير معروف: ${key}`,
        code: 'SETTING_UNKNOWN',
      });
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new BadRequestException({
        message: `قيمة غير صالحة للإعداد ${key}`,
        code: 'SETTING_INVALID_VALUE',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }

  // ─── Convenience: typed-get used by other services ───────
  async getValue<T>(storeId: string, key: string, defaultValue: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({
      where: { storeId_key: { storeId, key } },
    });
    if (row) return row.value as T;
    if (key in DEFAULT_STORE_SETTINGS) return DEFAULT_STORE_SETTINGS[key] as T;
    return defaultValue;
  }

  /** Re-export so callers don't need to import twice. */
  static readonly KEYS = SETTING_KEYS;
}
