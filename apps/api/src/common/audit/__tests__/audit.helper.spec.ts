/**
 * audit.helper — Jest spec.
 *
 * The helper is a thin wrapper around `tx.auditLog.create`. We assert:
 *   • Required fields are forwarded as-is.
 *   • `oldValues` / `newValues` / `metadata` undefined → SQL NULL (DbNull).
 *   • Empty objects → SQL NULL.
 *   • `entityId` defaults to null when omitted.
 *   • Plain object payloads pass through unchanged.
 */

import { Prisma } from '@prisma/client';

import { writeAuditLog } from '../audit.helper';

const buildTx = () => ({
  auditLog: {
    create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  },
});

describe('writeAuditLog', () => {
  it('writes a minimal row when only required fields are provided', async () => {
    const tx = buildTx();
    await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: 'actor-1',
      action: 'create',
      entityType: 'supplier',
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const args = tx.auditLog.create.mock.calls[0][0];
    expect(args.data.storeId).toBe('store-1');
    expect(args.data.actorId).toBe('actor-1');
    expect(args.data.action).toBe('create');
    expect(args.data.entityType).toBe('supplier');
    expect(args.data.entityId).toBeNull();
    expect(args.data.oldValues).toBe(Prisma.DbNull);
    expect(args.data.newValues).toBe(Prisma.DbNull);
    expect(args.data.metadata).toBe(Prisma.DbNull);
  });

  it('forwards newValues and metadata when they are non-empty objects', async () => {
    const tx = buildTx();
    await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: 'actor-1',
      action: 'create',
      entityType: 'purchase',
      entityId: 'p-1',
      newValues: { paymentType: 'CREDIT', totalAmount: '100.50' },
      metadata: { hasItems: true },
    });
    const args = tx.auditLog.create.mock.calls[0][0];
    expect(args.data.entityId).toBe('p-1');
    expect(args.data.newValues).toEqual({ paymentType: 'CREDIT', totalAmount: '100.50' });
    expect(args.data.metadata).toEqual({ hasItems: true });
  });

  it('collapses empty objects to SQL NULL', async () => {
    const tx = buildTx();
    await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: 'actor-1',
      action: 'update',
      entityType: 'customer',
      entityId: 'c-1',
      oldValues: {},
      newValues: {},
      metadata: {},
    });
    const args = tx.auditLog.create.mock.calls[0][0];
    expect(args.data.oldValues).toBe(Prisma.DbNull);
    expect(args.data.newValues).toBe(Prisma.DbNull);
    expect(args.data.metadata).toBe(Prisma.DbNull);
  });

  it('accepts a null actor (system-driven actions)', async () => {
    const tx = buildTx();
    await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: null,
      action: 'login_failed',
      entityType: 'user',
    });
    const args = tx.auditLog.create.mock.calls[0][0];
    expect(args.data.actorId).toBeNull();
  });

  it('returns the created row', async () => {
    const tx = buildTx();
    const result = await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: 'actor-1',
      action: 'cancel',
      entityType: 'purchase',
      entityId: 'p-1',
    });
    expect(result).toEqual({ id: 'audit-1' });
  });

  it('forwards ipAddress and userAgent when provided', async () => {
    const tx = buildTx();
    await writeAuditLog(tx as never, {
      storeId: 'store-1',
      actorId: 'actor-1',
      action: 'create',
      entityType: 'customer',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    });
    const args = tx.auditLog.create.mock.calls[0][0];
    expect(args.data.ipAddress).toBe('10.0.0.1');
    expect(args.data.userAgent).toBe('Mozilla/5.0');
  });
});
