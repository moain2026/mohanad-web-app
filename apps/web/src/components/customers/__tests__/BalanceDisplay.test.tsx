import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BalanceDisplay,
  balanceTone,
  formatBalance,
  toNumber,
} from '@/components/customers/BalanceDisplay';

describe('BalanceDisplay helpers', () => {
  it('toNumber parses strings and returns 0 for invalid', () => {
    expect(toNumber('123.45')).toBe(123.45);
    expect(toNumber(42)).toBe(42);
    expect(toNumber('abc')).toBe(0);
  });

  it('balanceTone returns debt/credit/clear', () => {
    expect(balanceTone(100)).toBe('debt');
    expect(balanceTone(-50)).toBe('credit');
    expect(balanceTone(0)).toBe('clear');
  });

  it('formatBalance renders sign and currency', () => {
    expect(formatBalance(-12.5)).toMatch(/−/);
    expect(formatBalance(0, { currency: '' })).not.toMatch(/ريال/);
    expect(formatBalance(10, { showSign: true })).toMatch(/\+/);
  });
});

describe('BalanceDisplay component', () => {
  it('shows debt label and red tone for positive balance', () => {
    render(<BalanceDisplay balance="500.00" />);
    expect(screen.getByText('مدين')).toBeInTheDocument();
    const figure = screen.getByTestId('balance-figure');
    expect(figure.dataset.balanceTone).toBe('debt');
  });

  it('shows credit label and blue tone for negative balance', () => {
    render(<BalanceDisplay balance={-100} />);
    expect(screen.getByText('دائن')).toBeInTheDocument();
    expect(screen.getByTestId('balance-figure').dataset.balanceTone).toBe('credit');
  });

  it('shows clear label and green tone for zero balance', () => {
    render(<BalanceDisplay balance={0} />);
    expect(screen.getByText('الرصيد صفر')).toBeInTheDocument();
    expect(screen.getByTestId('balance-figure').dataset.balanceTone).toBe('clear');
  });

  it('respects custom label', () => {
    render(<BalanceDisplay balance={1} label="رصيد افتتاحي" />);
    expect(screen.getByText('رصيد افتتاحي')).toBeInTheDocument();
  });
});
