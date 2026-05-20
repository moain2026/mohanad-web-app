/**
 * Settings — Zod schemas for Phase 7.
 *
 * Settings are stored in the generic `Setting` table as (key, value:json).
 * We define **typed** schemas per setting key so the API & UI agree on the
 * value shape. The list of known keys lives in `KNOWN_SETTING_KEYS` and is
 * the source of truth for the /settings page.
 */

import { z } from 'zod';

// ─── Canonical known keys ────────────────────────────────
export const SETTING_KEYS = {
  STORE_NAME: 'store.name',
  STORE_CURRENCY: 'store.currency',
  STORE_PHONE: 'store.phone',
  STORE_ADDRESS: 'store.address',
  LOCALE: 'app.locale',
  DEFAULT_SALE_MODE: 'sales.default_mode',
  LARGE_TX_THRESHOLD: 'transactions.large_threshold',
  OPENING_CASH_BALANCE: 'daily_income.opening_cash_default',
  INVENTORY_ENABLED: 'inventory.enabled',
  NOTIFICATIONS_WHATSAPP_ENABLED: 'notifications.whatsapp_enabled',
  CREDIT_LIMIT_DEFAULT: 'customers.credit_limit_default',
  REMINDER_DAY_OF_MONTH: 'notifications.reminder_day',
  BEHAVIOR_INACTIVE_DAYS: 'customers.inactive_threshold_days',
  DEBT_AGING_WARN_DAYS: 'customers.debt_aging_warn_days',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// ─── Per-key value validation ───────────────────────────
export const settingValueByKey: Record<string, z.ZodTypeAny> = {
  [SETTING_KEYS.STORE_NAME]: z.string().trim().min(1).max(120),
  [SETTING_KEYS.STORE_CURRENCY]: z.enum(['YER', 'SAR', 'USD', 'AED']),
  [SETTING_KEYS.STORE_PHONE]: z.string().trim().max(40).optional().nullable(),
  [SETTING_KEYS.STORE_ADDRESS]: z.string().trim().max(400).optional().nullable(),
  [SETTING_KEYS.LOCALE]: z.enum(['ar', 'en']),
  [SETTING_KEYS.DEFAULT_SALE_MODE]: z.enum(['QUICK', 'DETAILED', 'CREDIT']),
  [SETTING_KEYS.LARGE_TX_THRESHOLD]: z.coerce.number().nonnegative(),
  [SETTING_KEYS.OPENING_CASH_BALANCE]: z.coerce.number().nonnegative(),
  [SETTING_KEYS.INVENTORY_ENABLED]: z.coerce.boolean(),
  [SETTING_KEYS.NOTIFICATIONS_WHATSAPP_ENABLED]: z.coerce.boolean(),
  [SETTING_KEYS.CREDIT_LIMIT_DEFAULT]: z.coerce.number().nonnegative(),
  [SETTING_KEYS.REMINDER_DAY_OF_MONTH]: z.coerce.number().int().min(1).max(28),
  [SETTING_KEYS.BEHAVIOR_INACTIVE_DAYS]: z.coerce.number().int().min(1).max(365),
  [SETTING_KEYS.DEBT_AGING_WARN_DAYS]: z.coerce.number().int().min(1).max(365),
};

// ─── DTOs ────────────────────────────────────────────────
export const upsertSettingSchema = z.object({
  key: z.string().min(1).max(80),
  // `value` is any — we run type-specific validation in the service.
  value: z.unknown(),
});

export const upsertManySettingsSchema = z.object({
  items: z.array(upsertSettingSchema).min(1).max(50),
});

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;
export type UpsertManySettingsInput = z.infer<typeof upsertManySettingsSchema>;

/** Default values used when seeding a fresh store. */
export const DEFAULT_STORE_SETTINGS: Record<string, unknown> = {
  [SETTING_KEYS.STORE_NAME]: 'متجر البقالة',
  [SETTING_KEYS.STORE_CURRENCY]: 'YER',
  [SETTING_KEYS.STORE_PHONE]: null,
  [SETTING_KEYS.STORE_ADDRESS]: null,
  [SETTING_KEYS.LOCALE]: 'ar',
  [SETTING_KEYS.DEFAULT_SALE_MODE]: 'QUICK',
  [SETTING_KEYS.LARGE_TX_THRESHOLD]: 100000,
  [SETTING_KEYS.OPENING_CASH_BALANCE]: 0,
  [SETTING_KEYS.INVENTORY_ENABLED]: false,
  [SETTING_KEYS.NOTIFICATIONS_WHATSAPP_ENABLED]: false,
  [SETTING_KEYS.CREDIT_LIMIT_DEFAULT]: 0,
  [SETTING_KEYS.REMINDER_DAY_OF_MONTH]: 1,
  [SETTING_KEYS.BEHAVIOR_INACTIVE_DAYS]: 30,
  [SETTING_KEYS.DEBT_AGING_WARN_DAYS]: 60,
};
