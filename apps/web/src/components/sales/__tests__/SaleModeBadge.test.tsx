import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SaleModeBadge } from '@/components/sales/SaleModeBadge';

describe('SaleModeBadge', () => {
  it('renders QUICK variant', () => {
    render(<SaleModeBadge mode="QUICK" />);
    expect(screen.getByText('سريع')).toBeInTheDocument();
  });

  it('renders DETAILED variant', () => {
    render(<SaleModeBadge mode="DETAILED" />);
    expect(screen.getByText('مُفصَّل')).toBeInTheDocument();
  });

  it('renders CREDIT variant', () => {
    render(<SaleModeBadge mode="CREDIT" />);
    expect(screen.getByText('آجل')).toBeInTheDocument();
  });
});
