/**
 * IdempotencyCleanerService — Phase 2 polish.
 *
 * Purges expired rows from the `IdempotencyKey` table.
 *
 * Why this matters
 * ────────────────
 * The IdempotencyMiddleware writes a row for every successful POST/PUT/
 * PATCH/DELETE with a 24-hour TTL. Without cleanup, the table grows
 * unbounded — the existing `@@index([expiresAt])` keeps lookups fast,
 * but row count still affects backup size and table-bloat on Postgres.
 *
 * Design
 * ──────
 *   • `purgeExpired()` is the single source of truth. It deletes rows
 *     where `expiresAt < now()`, returns the count, and never throws —
 *     callers may invoke it from CLI, from a scheduled job, or
 *     opportunistically on hot paths (we do NOT do that today because
 *     it would add latency to every write — CLI / cron is the model).
 *
 *   • The method is idempotent: running it twice in a row is a no-op
 *     the second time. Safe to retry on failure.
 *
 *   • We use `deleteMany` (single query) rather than findMany→loop. With
 *     the existing `@@index([expiresAt])` Postgres uses an index range
 *     scan that scales to millions of rows without locking the table.
 *
 *   • For very large backlogs (e.g. > 100k rows) you may want to chunk
 *     the delete to avoid a long transaction. The `batchSize` option
 *     enables that: rows are deleted in batches of N until none remain.
 *     With `batchSize=undefined` (default) we issue a single `deleteMany`.
 *
 * Usage
 * ─────
 *   - CLI: `pnpm --filter @grocery/api cli:purge-idempotency`
 *     (calls `purgeExpired()` then exits with code 0).
 *   - Cron (example, run every 6h): `0 SLASH_STAR_6 * * *` followed by
 *     `cd /app && pnpm cli:purge-idempotency >> /var/log/purge.log 2>&1`
 *     (replace SLASH_STAR_6 with the literal `*` `/` `6` in your crontab).
 *   - Programmatic: inject the service and call `purgeExpired()`.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../modules/prisma/prisma.service';

export interface PurgeResult {
  /** Number of rows actually deleted. */
  deleted: number;
  /** Wall-clock duration of the operation in milliseconds. */
  durationMs: number;
  /** ISO timestamp of when the purge ran. */
  ranAt: string;
}

export interface PurgeOptions {
  /**
   * If provided, rows are deleted in chunks of this size. Useful for
   * very large backlogs. If omitted, a single `deleteMany` is issued.
   * Must be a positive integer.
   */
  batchSize?: number;
  /**
   * Optional override for "now". Tests pass a fixed Date so behaviour
   * is deterministic. In production this should always be left at the
   * default (real wall clock).
   */
  now?: Date;
}

@Injectable()
export class IdempotencyCleanerService {
  private readonly logger = new Logger(IdempotencyCleanerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delete every `IdempotencyKey` whose `expiresAt < now`.
   *
   * Returns: { deleted, durationMs, ranAt }
   *
   * Never throws on application-level conditions (empty table, etc.).
   * Will surface a `PrismaClientKnownRequestError` / connection error
   * up to the caller — those are real infra problems.
   */
  async purgeExpired(options: PurgeOptions = {}): Promise<PurgeResult> {
    const startedAt = Date.now();
    const now = options.now ?? new Date();
    const ranAt = now.toISOString();

    let deleted = 0;

    if (options.batchSize !== undefined) {
      // Validate batchSize.
      if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
        throw new Error(
          `IdempotencyCleanerService.purgeExpired: invalid batchSize ${options.batchSize}`,
        );
      }
      // ─── Chunked mode ─────────────────────────────────────
      // Repeatedly select up to `batchSize` expired row ids, then delete
      // them by id. Stops when a batch comes back empty.
      // We cap iterations defensively so a misconfigured caller can't
      // hang the process forever.
      const MAX_ITERATIONS = 10_000;
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const rows = await this.prisma.idempotencyKey.findMany({
          where: { expiresAt: { lt: now } },
          select: { id: true },
          take: options.batchSize,
        });
        if (rows.length === 0) break;
        const res = await this.prisma.idempotencyKey.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
        deleted += res.count;
        // If the DB returned fewer rows than the batch size, we're done.
        if (rows.length < options.batchSize) break;
      }
    } else {
      // ─── Single-shot mode ─────────────────────────────────
      const res = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      deleted = res.count;
    }

    const durationMs = Date.now() - startedAt;
    const result: PurgeResult = { deleted, durationMs, ranAt };

    if (deleted > 0) {
      this.logger.log(`IdempotencyKey purge: deleted ${deleted} expired row(s) in ${durationMs}ms`);
    } else {
      this.logger.debug(`IdempotencyKey purge: no expired rows (${durationMs}ms)`);
    }

    return result;
  }
}
