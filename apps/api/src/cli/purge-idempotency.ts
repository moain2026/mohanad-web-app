/**
 * CLI entry — purge expired IdempotencyKey rows.
 *
 * Usage
 * ─────
 *   pnpm --filter @grocery/api cli:purge-idempotency [--batch-size=1000]
 *
 * Or from a prod container:
 *   node dist/cli/purge-idempotency.js [--batch-size=1000]
 *
 * Exit codes
 * ──────────
 *   0  — success (regardless of how many rows were deleted)
 *   1  — any error during bootstrap or purge (logged to stderr)
 *
 * Recommended cron schedule
 * ─────────────────────────
 *   Every 6 hours, batched for safety with large backlogs. In your crontab
 *   put the literal cron expression `0` `<asterisk>/6` `<asterisk>` `<asterisk>` `<asterisk>`
 *   followed by:
 *     `cd /app && node dist/cli/purge-idempotency.js --batch-size=1000 >> /var/log/purge.log 2>&1`
 *
 * Design notes
 * ────────────
 *   • Uses `NestFactory.createApplicationContext` (NOT `create`) — this
 *     boots the DI container WITHOUT the HTTP layer. Much faster and
 *     doesn't open a port.
 *   • Logs in JSON-ish single-line format so log aggregators can parse.
 *   • Always calls `await app.close()` so the Prisma client disconnects
 *     cleanly (prevents "connection still open" warnings).
 */

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { AppModule } from '../app.module';
import { IdempotencyCleanerService } from '../common/idempotency/idempotency-cleaner.service';
import { HELP_TEXT, parseArgs } from './purge-idempotency.args';

// Re-export so tests / external callers can still import from this file.
export { parseArgs } from './purge-idempotency.args';

async function run(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const args = parseArgs(argv);
  const logger = new NestLogger('purge-idempotency');
  logger.log(`Starting purge (batchSize=${args.batchSize ?? 'single-shot'})…`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const cleaner = app.get(IdempotencyCleanerService);
    const result = await cleaner.purgeExpired({ batchSize: args.batchSize });
    logger.log(
      `Done: deleted=${result.deleted} durationMs=${result.durationMs} ranAt=${result.ranAt}`,
    );
  } finally {
    await app.close();
  }
}

// ─── Entrypoint guard ────────────────────────────────────────────
// Allows the file to be imported by tests (parseArgs) without executing.
if (require.main === module) {
  run(process.argv.slice(2)).then(
    () => process.exit(0),
    (err) => {
      const e = err as Error;
      process.stderr.write(`purge-idempotency failed: ${e.message}\n`);
      if (e.stack) process.stderr.write(`${e.stack}\n`);
      process.exit(1);
    },
  );
}
