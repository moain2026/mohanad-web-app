import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SaleCard } from '@/components/sales/SaleCard';
import type { Sale } from '@/lib/api/sales';

const baseSale: Sale = {
  id: 'sale-1',
  storeId: 'store-1',
  mode: 'QUICK',
  customerId: null,
  totalAmount: '99.00',
  notes: null,
  hasItems: false,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  createdById: 'u1',
  createdAt: new Date().toISOString(),
};

describe('SaleCard', () => {
  it('renders QUICK as cash sale with badge + total', () => {
    render(
      <MemoryRouter>
        <SaleCard sale={baseSale} />
      </MemoryRouter>,
    );
    expect(screen.getByText('بيع نقدي')).toBeInTheDocument();
    expect(screen.getByText('سريع')).toBeInTheDocument();
    expect(screen.getByTestId('sale-card-total').textContent).toMatch(/ريال/);
  });

  it('renders CREDIT with customer name', () => {
    render(
      <MemoryRouter>
        <SaleCard
          sale={{
            ...baseSale,
            mode: 'CREDIT',
            customerId: 'c1',
            customer: { id: 'c1', name: 'أحمد', phone: null },
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('أحمد')).toBeInTheDocument();
    expect(screen.getByText('آجل')).toBeInTheDocument();
  });

  it('marks cancelled sales', () => {
    render(
      <MemoryRouter>
        <SaleCard
          sale={{ ...baseSale, cancelledAt: new Date().toISOString(), cancelReason: 'r' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sale-card').dataset.cancelled).toBe('true');
    expect(screen.getByText('ملغاة')).toBeInTheDocument();
  });

  it('links to /sales/:id', () => {
    render(
      <MemoryRouter>
        <SaleCard sale={baseSale} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sale-card')).toHaveAttribute('href', '/sales/sale-1');
  });

  it('shows fallback when CREDIT customer missing', () => {
    render(
      <MemoryRouter>
        <SaleCard sale={{ ...baseSale, mode: 'CREDIT', customerId: 'c1', customer: null }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('عميل محذوف')).toBeInTheDocument();
  });
});
