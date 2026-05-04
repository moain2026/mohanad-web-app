import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PurchasePaymentBadge } from '@/components/purchases/PurchasePaymentBadge';

describe('PurchasePaymentBadge', () => {
  it('renders CASH variant', () => {
    render(<PurchasePaymentBadge paymentType="CASH" />);
    expect(screen.getByText('نقد')).toBeInTheDocument();
  });

  it('renders CREDIT variant', () => {
    render(<PurchasePaymentBadge paymentType="CREDIT" />);
    expect(screen.getByText('آجل')).toBeInTheDocument();
  });
});
