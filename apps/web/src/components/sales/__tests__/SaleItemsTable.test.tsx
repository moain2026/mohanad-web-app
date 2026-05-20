import { describe, expect, it } from 'vitest';

import {
  computeItemsTotal,
  computeRowTotal,
  makeBlankRow,
} from '@/components/sales/SaleItemsTable';

describe('SaleItemsTable helpers', () => {
  it('computeRowTotal multiplies quantity × unitPrice with 2-decimal rounding', () => {
    expect(computeRowTotal('3', '5.5')).toBe(16.5);
    expect(computeRowTotal('2.555', '4')).toBeCloseTo(10.22, 2);
    expect(computeRowTotal('', '5')).toBe(0);
    expect(computeRowTotal('abc', '5')).toBe(0);
  });

  it('computeItemsTotal sums all rows with 2-decimal rounding', () => {
    const rows = [
      { id: 'a', name: 'x', quantity: '2', unitPrice: '3' },
      { id: 'b', name: 'y', quantity: '1.5', unitPrice: '4' },
    ];
    expect(computeItemsTotal(rows)).toBe(12);
  });

  it('makeBlankRow returns row with empty strings + unique id', () => {
    const a = makeBlankRow();
    const b = makeBlankRow();
    expect(a.name).toBe('');
    expect(a.quantity).toBe('');
    expect(a.unitPrice).toBe('');
    expect(a.id).not.toBe(b.id);
  });
});
