/**
 * purge-idempotency — argument parser (extracted to its own module so
 * it can be unit-tested without booting AppModule / loading env vars).
 */

export interface ParsedArgs {
  batchSize?: number;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (const arg of argv) {
    if (arg.startsWith('--batch-size=')) {
      const raw = arg.slice('--batch-size='.length);
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        out.batchSize = n;
      } else {
        throw new Error(`Invalid --batch-size: "${raw}" (expected positive integer)`);
      }
    } else if (arg === '--help' || arg === '-h') {
      // Caller handles; we don't throw.
      out.batchSize = undefined;
    }
  }
  return out;
}

export const HELP_TEXT = `purge-idempotency — delete expired IdempotencyKey rows.

Usage:
  node dist/cli/purge-idempotency.js [options]

Options:
  --batch-size=<N>   Delete in chunks of N rows (default: single deleteMany).
  -h, --help         Show this help and exit.

Exit code: 0 on success, 1 on error.`;
