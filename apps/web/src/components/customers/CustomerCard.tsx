import { Phone, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui';

import type { Customer } from '@/lib/api/customers';
import { BalanceDisplay } from './BalanceDisplay';
import { StatusBadge } from './StatusBadge';

/**
 * CustomerCard — list-row card for customers list page.
 * Wraps in a <Link> to the customer detail route.
 */
export interface CustomerCardProps {
  customer: Customer;
}

export function CustomerCard({ customer }: CustomerCardProps): JSX.Element {
  return (
    <Link
      to={`/customers/${customer.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
      data-testid="customer-card"
    >
      <Card interactive className="hover:border-primary-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600 shrink-0">
              <User className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">{customer.name}</h3>
                <StatusBadge status={customer.status} graceUntil={customer.graceUntil} />
              </div>
              {customer.phone ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <Phone className="h-3 w-3" aria-hidden />
                  <span dir="ltr">{customer.phone}</span>
                </p>
              ) : null}
            </div>
          </div>
          <BalanceDisplay balance={customer.currentBalance} size="sm" />
        </div>
      </Card>
    </Link>
  );
}
