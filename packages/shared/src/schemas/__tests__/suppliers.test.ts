import { describe, expect, it } from 'vitest';
import {
  cancelSupplierTransactionSchema,
  createSupplierAdjustmentSchema,
  createSupplierPaymentSchema,
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierTransactionTypeEnum,
  updateSupplierSchema,
} from '../suppliers';

describe('createSupplierSchema', () => {
  it('accepts a minimal valid supplier', () => {
    const r = createSupplierSchema.safeParse({ name: 'مؤسسة الأمل' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.openingBalance).toBe(0);
  });

  it('accepts optional phone, whatsappPhone, address, notes', () => {
    const r = createSupplierSchema.safeParse({
      name: 'مورّد التجزئة',
      phone: '+967777111222',
      whatsappPhone: '+967777111222',
      address: 'صنعاء',
      notes: 'مورّد رئيسي للأرز',
      openingBalance: 5000,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.openingBalance).toBe(5000);
  });

  it('rejects empty name', () => {
    const r = createSupplierSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('rejects negative openingBalance', () => {
    const r = createSupplierSchema.safeParse({ name: 'X', openingBalance: -10 });
    expect(r.success).toBe(false);
  });

  it('rejects malformed phone', () => {
    const r = createSupplierSchema.safeParse({ name: 'X', phone: 'not-a-number' });
    expect(r.success).toBe(false);
  });
});

describe('updateSupplierSchema', () => {
  it('accepts a partial update with null address', () => {
    const r = updateSupplierSchema.safeParse({ name: 'New Name', address: null });
    expect(r.success).toBe(true);
  });

  it('accepts an empty body (all fields optional)', () => {
    const r = updateSupplierSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe('listSuppliersQuerySchema', () => {
  it('coerces string booleans for isActive / hasBalance', () => {
    const r = listSuppliersQuerySchema.safeParse({ isActive: 'true', hasBalance: 'false' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isActive).toBe(true);
      expect(r.data.hasBalance).toBe(false);
    }
  });

  it('applies default pagination', () => {
    const r = listSuppliersQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBeGreaterThan(0);
    }
  });
});

describe('createSupplierPaymentSchema', () => {
  it('requires positive amount', () => {
    expect(createSupplierPaymentSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(createSupplierPaymentSchema.safeParse({ amount: -10 }).success).toBe(false);
    expect(createSupplierPaymentSchema.safeParse({ amount: 100 }).success).toBe(true);
  });
});

describe('createSupplierAdjustmentSchema', () => {
  it('rejects zero amount', () => {
    expect(createSupplierAdjustmentSchema.safeParse({ amount: 0, notes: 'reason' }).success).toBe(
      false,
    );
  });

  it('accepts negative amount with notes', () => {
    const r = createSupplierAdjustmentSchema.safeParse({ amount: -50, notes: 'تسوية' });
    expect(r.success).toBe(true);
  });

  it('requires non-empty notes', () => {
    expect(createSupplierAdjustmentSchema.safeParse({ amount: 50, notes: '' }).success).toBe(false);
  });
});

describe('cancelSupplierTransactionSchema', () => {
  it('requires non-empty reason', () => {
    expect(cancelSupplierTransactionSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(cancelSupplierTransactionSchema.safeParse({ reason: 'تم تسجيلها بالخطأ' }).success).toBe(
      true,
    );
  });
});

describe('supplierTransactionTypeEnum', () => {
  it('lists the 4 expected types', () => {
    expect(supplierTransactionTypeEnum.options).toEqual([
      'OPENING',
      'CREDIT_PURCHASE',
      'PAYMENT',
      'ADJUSTMENT',
    ]);
  });
});
