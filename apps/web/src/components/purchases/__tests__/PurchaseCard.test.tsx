import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PurchaseCard } from '@/components/purchases/PurchaseCard';
import type { Purchase } from '@/lib/api/purchases';

const basePurchase: Purchase = {
  id: 'pur-1',
  storeId: 'store-1',
  supplierId: 'sup-1',
  paymentType: 'CASH',
  totalAmount: '1500.00',
  notes: null,
  hasItems: true,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  supplier: { id: 'sup-1', name: 'شركة الواحة', phone: null },
};

describe('PurchaseCard', () => {
  it('renders supplier name + total + CASH badge', () => {
    render(
      <MemoryRouter>
        <PurchaseCard purchase={basePurchase} />
      </MemoryRouter>,
    );
    expect(screen.getByText('شركة الواحة')).toBeInTheDocument();
    expect(screen.getByText('نقد')).toBeInTheDocument();
    // ar-SA Intl formats with Arabic-Indic digits (١٬٥٠٠٫٠٠) — assert on data attr.
    expect(screen.getByTestId('purchase-card-total').textContent).toMatch(/ريال/);
  });

  it('renders CREDIT badge', () => {
    render(
      <MemoryRouter>
        <PurchaseCard purchase={{ ...basePurchase, paymentType: 'CREDIT' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('آجل')).toBeInTheDocument();
  });

  it('marks cancelled purchases', () => {
    render(
      <MemoryRouter>
        <PurchaseCard
          purchase={{
            ...basePurchase,
            cancelledAt: new Date().toISOString(),
            cancelReason: 'إعادة للمورّد',
          }}
        />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('purchase-card');
    expect(card.dataset.cancelled).toBe('true');
    expect(screen.getByText('ملغاة')).toBeInTheDocument();
  });

  it('links to /purchases/:id', () => {
    render(
      <MemoryRouter>
        <PurchaseCard purchase={basePurchase} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('purchase-card')).toHaveAttribute('href', '/purchases/pur-1');
  });

  it('shows fallback label when supplier missing', () => {
    render(
      <MemoryRouter>
        <PurchaseCard purchase={{ ...basePurchase, supplier: undefined }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('مورّد محذوف')).toBeInTheDocument();
  });
});
