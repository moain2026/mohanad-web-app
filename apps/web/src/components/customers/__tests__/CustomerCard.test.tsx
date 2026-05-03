import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CustomerCard } from '@/components/customers/CustomerCard';
import type { Customer } from '@/lib/api/customers';

const baseCustomer: Customer = {
  id: 'cust-1',
  name: 'محمد العتيبي',
  phone: '0501112222',
  whatsappPhone: null,
  currentBalance: '250.00',
  creditLimit: null,
  status: 'ACTIVE',
  graceUntil: null,
  createdAt: new Date().toISOString(),
};

describe('CustomerCard', () => {
  it('renders name + phone + balance + active status', () => {
    render(
      <MemoryRouter>
        <CustomerCard customer={baseCustomer} />
      </MemoryRouter>,
    );
    expect(screen.getByText('محمد العتيبي')).toBeInTheDocument();
    expect(screen.getByText('0501112222')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();
    expect(screen.getByTestId('balance-figure').dataset.balanceTone).toBe('debt');
  });

  it('links to /customers/:id', () => {
    render(
      <MemoryRouter>
        <CustomerCard customer={baseCustomer} />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('customer-card');
    expect(link).toHaveAttribute('href', '/customers/cust-1');
  });

  it('shows frozen state', () => {
    render(
      <MemoryRouter>
        <CustomerCard customer={{ ...baseCustomer, status: 'FROZEN' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('مجمَّد')).toBeInTheDocument();
  });
});
