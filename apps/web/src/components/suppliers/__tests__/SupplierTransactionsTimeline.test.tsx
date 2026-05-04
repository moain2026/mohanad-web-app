import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupplierTransactionsTimeline } from '@/components/suppliers/SupplierTransactionsTimeline';
import type { SupplierTransaction } from '@/lib/api/suppliers';

const tx = (over: Partial<SupplierTransaction>): SupplierTransaction => ({
  id: 'tx-1',
  supplierId: 'sup-1',
  type: 'PAYMENT',
  amount: '100.00',
  balanceBefore: '500.00',
  balanceAfter: '400.00',
  notes: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  referenceType: null,
  referenceId: null,
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  ...over,
});

describe('SupplierTransactionsTimeline', () => {
  it('shows empty state when no items', () => {
    render(<SupplierTransactionsTimeline items={[]} />);
    expect(screen.getByTestId('supplier-timeline-empty')).toBeInTheDocument();
  });

  it('renders rows with type-specific labels', () => {
    render(
      <SupplierTransactionsTimeline
        items={[
          tx({ id: 'a', type: 'OPENING' }),
          tx({ id: 'b', type: 'CREDIT_PURCHASE' }),
          tx({ id: 'c', type: 'PAYMENT' }),
          tx({ id: 'd', type: 'ADJUSTMENT' }),
        ]}
      />,
    );
    expect(screen.getByText('رصيد افتتاحي')).toBeInTheDocument();
    expect(screen.getByText('شراء آجل')).toBeInTheDocument();
    expect(screen.getByText('دفعة للمورّد')).toBeInTheDocument();
    expect(screen.getByText('تسوية')).toBeInTheDocument();
  });

  it('marks cancelled rows', () => {
    render(
      <SupplierTransactionsTimeline
        items={[
          tx({
            id: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelReason: 'خطأ في الإدخال',
          }),
        ]}
      />,
    );
    const row = screen.getByTestId('supplier-tx-row-cancelled');
    expect(row.dataset.cancelled).toBe('true');
    expect(screen.getByText('ملغاة')).toBeInTheDocument();
    expect(screen.getByText(/خطأ في الإدخال/)).toBeInTheDocument();
  });

  it('renders rowActions render-prop slot', () => {
    render(
      <SupplierTransactionsTimeline
        items={[tx({})]}
        rowActions={(t) => (
          <button type="button" data-testid={`act-${t.id}`}>
            إلغاء
          </button>
        )}
      />,
    );
    expect(screen.getByTestId('act-tx-1')).toBeInTheDocument();
  });
});
