/**
 * Audit log helper.
 *
 * Centralises the shape of `AuditLog` rows that customer / supplier /
 * purchase services have been writing inline since Phase 3. The function is
 * intentionally a thin wrapper so that:
 *
 *   1. The required fields (`storeId`, `actorId`, `action`, `entityType`)
 *      can never be forgotten — TypeScript enforces it.
 *   2. `newValues` / `oldValues` / `metadata` are JSON-serialisable (we cast
 *      to Prisma's `InputJsonValue` so primitives, Date strings, and nested
 *      objects all flow through without surprises).
 *   3. The audit row is always written inside the **caller's** transaction
 *      (`tx`), keeping atomicity guarantees: if the business mutation rolls
 *      back, the audit row rolls back with it. Callers must pass the same
 *      `tx` they're using for the rest of the mutation.
 *
 * Existing inline `tx.auditLog.create({...})` calls are still valid — this
 * helper is additive. New code, and any future refactors, should prefer
 * `writeAuditLog`.
 *
 * @example
 *   await this.prisma.$transaction(async (tx) => {
 *     const purchase = await tx.purchase.create({ data: ... });
 *     await writeAuditLog(tx, {
 *       storeId: scope.storeId,
 *       actorId: scope.actorId,
 *       action: 'create',
 *       entityType: 'purchase',
 *       entityId: purchase.id,
 *       newValues: { paymentType: 'CASH', totalAmount },
 *     });
 *     return purchase;
 *   });
 */

import { type AuditAction, Prisma, type PrismaClient } from '@prisma/client';

/**
 * Subset of the Prisma client that exposes the auditLog delegate. Both the
 * top-level PrismaClient and the inner $transaction callback parameter
 * satisfy this shape, so the helper can be called from either context.
 */
export type AuditTxClient = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;

export interface WriteAuditLogOptions {
  /** Tenant store id — every audit row is scoped per store. */
  storeId: string;
  /** Acting user id; null when the action is system-driven. */
  actorId: string | null;
  /** Discrete enum value (see prisma/schema.prisma `AuditAction`). */
  action: AuditAction;
  /** Lowercase singular entity name, e.g. `customer`, `purchase`. */
  entityType: string;
  /** Target row id; omit for actions that don't target a specific row. */
  entityId?: string | null;
  /** JSON-friendly snapshot before mutation. */
  oldValues?: Record<string, unknown> | null;
  /** JSON-friendly snapshot after mutation. */
  newValues?: Record<string, unknown> | null;
  /** Free-form metadata (e.g. flags, related ids, reason). */
  metadata?: Record<string, unknown> | null;
  /** Request IP propagated from middleware. */
  ipAddress?: string | null;
  /** Request user-agent propagated from middleware. */
  userAgent?: string | null;
}

/**
 * Writes a single `AuditLog` row using the supplied Prisma transaction
 * client. Returns the created row.
 *
 * The function never throws on its own — Prisma errors propagate, which is
 * what we want so the surrounding `$transaction` rolls back.
 */
export async function writeAuditLog(tx: AuditTxClient, opts: WriteAuditLogOptions) {
  const {
    storeId,
    actorId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    metadata,
    ipAddress,
    userAgent,
  } = opts;

  return tx.auditLog.create({
    data: {
      storeId,
      actorId,
      action,
      entityType,
      entityId: entityId ?? null,
      oldValues: serialise(oldValues),
      newValues: serialise(newValues),
      metadata: serialise(metadata),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

/**
 * Returns a Prisma-compatible value for a *nullable* JSON column.
 *
 * Prisma rejects raw `null` for nullable Json columns — it requires the
 * sentinel `Prisma.JsonNull` (writes a literal JSON `null`) or
 * `Prisma.DbNull` (writes a SQL `NULL`). We use `DbNull` because that
 * matches the historical inline shape (`oldValues: undefined` → column
 * stored as SQL NULL).
 *
 * Empty objects (`{}`) are also collapsed to `DbNull` to keep rows compact.
 */
function serialise(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  if (Object.keys(value).length === 0) return Prisma.DbNull;
  // Cast: the caller's type is constrained to plain JSON-safe records.
  return value as Prisma.InputJsonValue;
}
