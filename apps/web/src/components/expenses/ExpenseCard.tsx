import { Wallet, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';

import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import type { Expense } from '@/lib/api/expenses';
import { ExpenseTypeBadge } from './ExpenseTypeBadge';

/**
 * ExpenseCard — list-row card for the expenses list page.
 *
 *   • Shows category, type (NORMAL/SUPPLIER_PAYMENT/CASH_PURCHASE_LINK),
 *     amount, expense date.
 *   • Visually marks cancelled rows with reduced opacity + badge.
 */
export interface ExpenseCardProps {
  expense: Expense;
}

export function ExpenseCard({ expense }: ExpenseCardProps): JSX.Element {
  const cancelled = !!expense.cancelledAt;
  return (
    <Link
      to={`/expenses/${expense.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
      data-testid="expense-card"
      data-cancelled={cancelled}
    >
      <Card
        interactive
        className={cancelled ? 'opacity-60 hover:border-gray-200' : 'hover:border-primary-200'}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 shrink-0">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">
                  {expense.category?.name ?? 'فئة محذوفة'}
                </h3>
                <ExpenseTypeBadge type={expense.type} />
                {cancelled ? (
                  <Badge variant="neutral" icon={<XCircle className="h-3 w-3" aria-hidden />}>
                    ملغى
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{expense.description}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {new Date(expense.expenseDate).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-gray-500">المبلغ</span>
            <span
              className="text-base font-bold tabular-nums text-ink"
              data-testid="expense-card-amount"
            >
              {formatSupplierBalance(toNumber(expense.amount))}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
