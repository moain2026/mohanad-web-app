import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  SupplierBalanceDisplay,
  formatSupplierBalance,
  supplierBalanceTone,
  toNumber,
} from '@/components/suppliers/SupplierBalanceDisplay';

describe('SupplierBalanceDisplay helpers', () => {
  it('toNumber parses strings and returns 0 for invalid', () => {
    expect(toNumber('123.45')).toBe(123.45);
    expect(toNumber(42)).toBe(42);
    expect(toNumber('abc')).toBe(0);
  });

  it('supplierBalanceTone returns owed/overpaid/clear', () => {
    expect(supplierBalanceTone(100)).toBe('owed');
    expect(supplierBalanceTone(-50)).toBe('overpaid');
    expect(supplierBalanceTone(0)).toBe('clear');
  });

  it('formatSupplierBalance renders sign and currency', () => {
    expect(formatSupplierBalance(-12.5)).toMatch(/−/);
    expect(formatSupplierBalance(0, '')).not.toMatch(/ريال/);
    expect(formatSupplierBalance(10)).toMatch(/ريال/);
  });
});

describe('SupplierBalanceDisplay component', () => {
  it('shows owed label and red tone for positive balance', () => {
    render(<SupplierBalanceDisplay balance="500.00" />);
    expect(screen.getByText('مدينون له')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-balance-figure').dataset.supplierBalanceTone).toBe('owed');
  });

  it('shows overpaid label and blue tone for negative balance', () => {
    render(<SupplierBalanceDisplay balance={-100} />);
    expect(screen.getByText('دائن لنا')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-balance-figure').dataset.supplierBalanceTone).toBe(
      'overpaid',
    );
  });

  it('shows clear label and green tone for zero balance', () => {
    render(<SupplierBalanceDisplay balance={0} />);
    expect(screen.getByText('الرصيد مسوّى')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-balance-figure').dataset.supplierBalanceTone).toBe('clear');
  });

  it('respects custom label', () => {
    render(<SupplierBalanceDisplay balance={1} label="رصيد افتتاحي" />);
    expect(screen.getByText('رصيد افتتاحي')).toBeInTheDocument();
  });
});
