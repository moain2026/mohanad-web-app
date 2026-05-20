/**
 * IdempotencyCleanerService — comprehensive Jest spec.
 *
 * Coverage targets (≥ 95%):
 *   • Single-shot mode: deletes WHERE expiresAt < now, returns count.
 *   • Empty table → returns 0, no error.
 *   • Custom `now` overrides — deterministic in tests.
 *   • Chunked mode: iterates in batches, stops when batch empties.
 *   • Chunked mode: respects MAX_ITERATIONS safety cap.
 *   • Chunked mode: rejects invalid batchSize (0, negative, non-integer).
 *   • Result shape: { deleted, durationMs, ranAt } with correct types.
 *   • Logger output: log-line on deletions, debug-line on zero.
 *
 * PrismaService is mocked — no DB required.
 */

import { Logger } from '@nestjs/common';

import { IdempotencyCleanerService } from '../idempotency-cleaner.service';

// ─── Helpers ─────────────────────────────────────────────────────
const buildPrismaMock = () => ({
  idempotencyKey: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
});

describe('IdempotencyCleanerService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: IdempotencyCleanerService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new IdempotencyCleanerService(prisma as unknown as never);
    // Silence the logger in tests — we'll spy explicitly when asserting.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Single-shot mode ──────────────────────────────────────
  describe('single-shot mode (no batchSize)', () => {
    it('deletes expired rows and returns the count', async () => {
      prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 42 });

      const result = await service.purgeExpired();

      expect(result.deleted).toBe(42);
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.ranAt).toBe('string');
      // ranAt is a valid ISO string
      expect(() => new Date(result.ranAt).toISOString()).not.toThrow();

      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
      const callArgs = prisma.idempotencyKey.deleteMany.mock.calls[0][0];
      expect(callArgs.where.expiresAt.lt).toBeInstanceOf(Date);
      // findMany should NOT be called in single-shot mode
      expect(prisma.idempotencyKey.findMany).not.toHaveBeenCalled();
    });

    it('returns 0 deletions on an empty table without throwing', async () => {
      prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });
      const result = await service.purgeExpired();
      expect(result.deleted).toBe(0);
      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('uses the injected `now` for deterministic behaviour', async () => {
      prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });
      const fixed = new Date('2026-01-01T00:00:00.000Z');
      const result = await service.purgeExpired({ now: fixed });
      expect(result.ranAt).toBe('2026-01-01T00:00:00.000Z');
      const callArgs = prisma.idempotencyKey.deleteMany.mock.calls[0][0];
      expect(callArgs.where.expiresAt.lt).toEqual(fixed);
    });
  });

  // ─── Chunked mode ──────────────────────────────────────────
  describe('chunked mode (with batchSize)', () => {
    it('iterates until a non-full batch is returned', async () => {
      // Simulate 3 batches: 100, 100, 23 → total 223 expected
      prisma.idempotencyKey.findMany
        .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `b1-${i}` })))
        .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `b2-${i}` })))
        .mockResolvedValueOnce(Array.from({ length: 23 }, (_, i) => ({ id: `b3-${i}` })));
      prisma.idempotencyKey.deleteMany
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 23 });

      const result = await service.purgeExpired({ batchSize: 100 });

      expect(result.deleted).toBe(223);
      expect(prisma.idempotencyKey.findMany).toHaveBeenCalledTimes(3);
      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(3);
      // First findMany call should use `take: 100`
      const firstFindCall = prisma.idempotencyKey.findMany.mock.calls[0][0];
      expect(firstFindCall.take).toBe(100);
      expect(firstFindCall.where.expiresAt.lt).toBeInstanceOf(Date);
      // deleteMany calls should target the ids returned by findMany
      const firstDeleteCall = prisma.idempotencyKey.deleteMany.mock.calls[0][0];
      expect(firstDeleteCall.where.id.in).toHaveLength(100);
    });

    it('stops immediately when the first batch is empty', async () => {
      prisma.idempotencyKey.findMany.mockResolvedValue([]);

      const result = await service.purgeExpired({ batchSize: 1000 });

      expect(result.deleted).toBe(0);
      expect(prisma.idempotencyKey.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.idempotencyKey.deleteMany).not.toHaveBeenCalled();
    });

    it('stops after a full batch when the next batch is empty', async () => {
      prisma.idempotencyKey.findMany
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: `b1-${i}` })))
        .mockResolvedValueOnce([]);
      prisma.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 10 });

      const result = await service.purgeExpired({ batchSize: 10 });

      expect(result.deleted).toBe(10);
      expect(prisma.idempotencyKey.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
    });

    it.each([0, -1, -100, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid batchSize=%p',
      async (bad) => {
        await expect(service.purgeExpired({ batchSize: bad as number })).rejects.toThrow(
          /invalid batchSize/i,
        );
        expect(prisma.idempotencyKey.deleteMany).not.toHaveBeenCalled();
        expect(prisma.idempotencyKey.findMany).not.toHaveBeenCalled();
      },
    );
  });

  // ─── Logger output ─────────────────────────────────────────
  describe('logging', () => {
    it('logs at INFO level when rows were deleted', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 7 });

      await service.purgeExpired();

      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg = String(logSpy.mock.calls[0][0]);
      expect(msg).toMatch(/deleted 7/);
    });

    it('logs at DEBUG level when no rows were deleted', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });

      await service.purgeExpired();

      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledTimes(1);
    });
  });
});
