import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SupplierCard } from '@/components/suppliers/SupplierCard';
import type { Supplier } from '@/lib/api/suppliers';

const baseSupplier: Supplier = {
  id: 'sup-1',
  name: 'شركة الواحة للتموين',
  phone: '0501112222',
  whatsappPhone: null,
  currentBalance: '750.00',
  isActive: true,
  createdAt: new Date().toISOString(),
};

describe('SupplierCard', () => {
  it('renders name + phone + balance + active badge', () => {
    render(
      <MemoryRouter>
        <SupplierCard supplier={baseSupplier} />
      </MemoryRouter>,
    );
    expect(screen.getByText('شركة الواحة للتموين')).toBeInTheDocument();
    expect(screen.getByText('0501112222')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-balance-figure').dataset.supplierBalanceTone).toBe('owed');
  });

  it('links to /suppliers/:id', () => {
    render(
      <MemoryRouter>
        <SupplierCard supplier={baseSupplier} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('supplier-card')).toHaveAttribute('href', '/suppliers/sup-1');
  });

  it('shows inactive state', () => {
    render(
      <MemoryRouter>
        <SupplierCard supplier={{ ...baseSupplier, isActive: false }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('غير نشط')).toBeInTheDocument();
  });

  it('shows clear tone for zero balance', () => {
    render(
      <MemoryRouter>
        <SupplierCard supplier={{ ...baseSupplier, currentBalance: '0' }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('supplier-balance-figure').dataset.supplierBalanceTone).toBe('clear');
  });
});
