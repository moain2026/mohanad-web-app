import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import type { Expense } from '@/lib/api/expenses';

const baseExpense: Expense = {
  id: 'exp-1',
  storeId: 'store-1',
  categoryId: 'cat-1',
  type: 'NORMAL',
  amount: '120.50',
  description: 'فاتورة الكهرباء',
  expenseDate: new Date().toISOString(),
  referenceType: null,
  referenceId: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  category: { id: 'cat-1', name: 'كهرباء' },
};

describe('ExpenseCard', () => {
  it('renders category + description + NORMAL badge', () => {
    render(
      <MemoryRouter>
        <ExpenseCard expense={baseExpense} />
      </MemoryRouter>,
    );
    expect(screen.getByText('كهرباء')).toBeInTheDocument();
    expect(screen.getByText('فاتورة الكهرباء')).toBeInTheDocument();
    expect(screen.getByText('عادي')).toBeInTheDocument();
    expect(screen.getByTestId('expense-card-amount').textContent).toMatch(/ريال/);
  });

  it('marks cancelled expenses', () => {
    render(
      <MemoryRouter>
        <ExpenseCard
          expense={{
            ...baseExpense,
            cancelledAt: new Date().toISOString(),
            cancelReason: 'خطأ في الإدخال',
          }}
        />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('expense-card');
    expect(card.dataset.cancelled).toBe('true');
    expect(screen.getByText('ملغى')).toBeInTheDocument();
  });

  it('links to /expenses/:id', () => {
    render(
      <MemoryRouter>
        <ExpenseCard expense={baseExpense} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('expense-card')).toHaveAttribute('href', '/expenses/exp-1');
  });

  it('renders SUPPLIER_PAYMENT badge', () => {
    render(
      <MemoryRouter>
        <ExpenseCard expense={{ ...baseExpense, type: 'SUPPLIER_PAYMENT' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('دفعة مورّد')).toBeInTheDocument();
  });

  it('shows fallback label when category missing', () => {
    render(
      <MemoryRouter>
        <ExpenseCard expense={{ ...baseExpense, category: undefined }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('فئة محذوفة')).toBeInTheDocument();
  });
});
