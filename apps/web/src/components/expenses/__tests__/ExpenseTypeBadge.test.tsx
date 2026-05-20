import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExpenseTypeBadge } from '@/components/expenses/ExpenseTypeBadge';

describe('ExpenseTypeBadge', () => {
  it('renders NORMAL variant', () => {
    render(<ExpenseTypeBadge type="NORMAL" />);
    expect(screen.getByText('عادي')).toBeInTheDocument();
  });

  it('renders SUPPLIER_PAYMENT variant', () => {
    render(<ExpenseTypeBadge type="SUPPLIER_PAYMENT" />);
    expect(screen.getByText('دفعة مورّد')).toBeInTheDocument();
  });

  it('renders CASH_PURCHASE_LINK variant', () => {
    render(<ExpenseTypeBadge type="CASH_PURCHASE_LINK" />);
    expect(screen.getByText('ربط شراء نقدي')).toBeInTheDocument();
  });
});
