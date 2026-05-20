/**
 * Notification Templates — Zod schemas for Phase 8.
 */

import { z } from 'zod';

export const notificationChannelSchema = z.enum(['INTERNAL', 'WHATSAPP']);
export type NotificationChannelValue = z.infer<typeof notificationChannelSchema>;

/** Canonical template keys — seeded as system templates. */
export const TEMPLATE_KEYS = {
  MONTHLY_REMINDER: 'monthly_reminder',
  DEBT_HIGH: 'debt_high',
  CREDIT_LIMIT_EXCEEDED: 'credit_limit_exceeded',
  GRACE_PERIOD_ENDING: 'grace_period_ending',
  CUSTOMER_INACTIVE: 'customer_inactive',
  LARGE_SALE_INTERNAL: 'large_sale_internal',
} as const;

export const createTemplateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'مفتاح القالب: حروف صغيرة وأرقام و _ فقط'),
  name: z.string().trim().min(1).max(120),
  channel: notificationChannelSchema,
  bodyTemplate: z.string().trim().min(1).max(2000),
  placeholders: z.array(z.string().min(1).max(40)).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial().omit({ key: true }).extend({
  isActive: z.boolean().optional(),
});

export const listTemplatesQuerySchema = z.object({
  channel: notificationChannelSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

// ─── Password reset ─────────────────────────────────────
export const requestPasswordResetSchema = z.object({
  username: z.string().trim().min(1).max(60),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(20).max(128),
  newPassword: z.string().min(8).max(72),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
