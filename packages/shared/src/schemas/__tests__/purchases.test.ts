import { describe, expect, it } from 'vitest';
import {
  cancelPurchaseSchema,
  createPurchaseSchema,
  listPurchasesQuerySchema,
  purchaseItemSchema,
  purchasePaymentTypeEnum,
} from '../purchases';

const VALID_CUID = `c${'a'.repeat(24)}`;

describe('purchaseItemSchema', () => {
  it('computes totalCost from quantity * unitCost', () => {
    const r = purchaseItemSchema.safeParse({ name: 'سكر', quantity: 5, unitCost: 200 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.totalCost).toBe(1000);
  });

  it('rejects empty product name', () => {
    expect(purchaseItemSchema.safeParse({ name: '', quantity: 1, unitCost: 1 }).success).toBe(
      false,
    );
  });

  it('rejects zero or negative quantity', () => {
    expect(purchaseItemSchema.safeParse({ name: 'X', quantity: 0, unitCost: 5 }).success).toBe(
      false,
    );
  });

  it('allows zero unitCost (free sample)', () => {
    const r = purchaseItemSchema.safeParse({ name: 'X', quantity: 2, unitCost: 0 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.totalCost).toBe(0);
  });
});

describe('createPurchaseSchema — payment type', () => {
  it('accepts a CASH purchase without items', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CASH',
      totalAmount: 500,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a CREDIT purchase without items', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CREDIT',
      totalAmount: 1500,
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown payment type', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CHECK',
      totalAmount: 100,
    });
    expect(r.success).toBe(false);
  });
});

describe('createPurchaseSchema — items consistency', () => {
  it('accepts a purchase whose totalAmount equals sum of items', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CREDIT',
      totalAmount: 1500,
      items: [
        { name: 'سكر', quantity: 5, unitCost: 200 }, // 1000
        { name: 'أرز', quantity: 5, unitCost: 100 }, // 500
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects mismatched totalAmount vs items sum', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CREDIT',
      totalAmount: 999, // wrong (should be 1500)
      items: [
        { name: 'سكر', quantity: 5, unitCost: 200 },
        { name: 'أرز', quantity: 5, unitCost: 100 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('tolerates 1-cent rounding', () => {
    const r = createPurchaseSchema.safeParse({
      supplierId: VALID_CUID,
      paymentType: 'CASH',
      totalAmount: 333.33,
      items: [{ name: 'X', quantity: 3, unitCost: 111.11 }], // 333.33
    });
    expect(r.success).toBe(true);
  });
});

describe('listPurchasesQuerySchema', () => {
  it('coerces date params and accepts a payment-type filter', () => {
    const r = listPurchasesQuerySchema.safeParse({
      paymentType: 'CASH',
      from: '2026-01-01',
      to: '2026-12-31',
      includeCancelled: 'true',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.paymentType).toBe('CASH');
      expect(r.data.from).toBeInstanceOf(Date);
      expect(r.data.includeCancelled).toBe(true);
    }
  });
});

describe('cancelPurchaseSchema', () => {
  it('requires reason text', () => {
    expect(cancelPurchaseSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(cancelPurchaseSchema.safeParse({ reason: 'سبب' }).success).toBe(true);
  });
});

describe('purchasePaymentTypeEnum', () => {
  it('exposes only CASH and CREDIT', () => {
    expect(purchasePaymentTypeEnum.options).toEqual(['CASH', 'CREDIT']);
  });
});
