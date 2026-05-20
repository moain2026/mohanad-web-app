/**
 * purge-idempotency CLI — argument parser spec.
 *
 * We don't test the full CLI bootstrap (that would require booting a real
 * AppModule + DB). We only test `parseArgs` because that's the surface
 * area the cron user actually touches.
 */

import { parseArgs } from '../purge-idempotency.args';

describe('purge-idempotency.parseArgs', () => {
  it('returns an empty object when no args are given', () => {
    expect(parseArgs([])).toEqual({});
  });

  it('parses --batch-size=NNN into a positive integer', () => {
    expect(parseArgs(['--batch-size=1000'])).toEqual({ batchSize: 1000 });
    expect(parseArgs(['--batch-size=1'])).toEqual({ batchSize: 1 });
  });

  it('ignores unrelated arguments', () => {
    expect(parseArgs(['--verbose', 'something', '--batch-size=500'])).toEqual({
      batchSize: 500,
    });
  });

  it('treats --help / -h as a no-op for the parser (handled by `run`)', () => {
    expect(parseArgs(['--help'])).toEqual({ batchSize: undefined });
    expect(parseArgs(['-h'])).toEqual({ batchSize: undefined });
  });

  it.each(['--batch-size=0', '--batch-size=-1', '--batch-size=abc', '--batch-size='])(
    'throws on invalid value: %s',
    (arg) => {
      expect(() => parseArgs([arg])).toThrow(/Invalid --batch-size/);
    },
  );
});
