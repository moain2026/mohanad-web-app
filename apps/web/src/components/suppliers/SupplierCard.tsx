import { Phone, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui';

import type { Supplier } from '@/lib/api/suppliers';
import { SupplierBalanceDisplay } from './SupplierBalanceDisplay';
import { SupplierStatusBadge } from './SupplierStatusBadge';

/**
 * SupplierCard — list-row card for the suppliers list page.
 * Mirrors `CustomerCard` but with supplier-oriented copy and balance tones.
 */
export interface SupplierCardProps {
  supplier: Supplier;
}

export function SupplierCard({ supplier }: SupplierCardProps): JSX.Element {
  return (
    <Link
      to={`/suppliers/${supplier.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
      data-testid="supplier-card"
    >
      <Card interactive className="hover:border-primary-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600 shrink-0">
              <Truck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">{supplier.name}</h3>
                <SupplierStatusBadge isActive={supplier.isActive} />
              </div>
              {supplier.phone ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <Phone className="h-3 w-3" aria-hidden />
                  <span dir="ltr">{supplier.phone}</span>
                </p>
              ) : null}
            </div>
          </div>
          <SupplierBalanceDisplay balance={supplier.currentBalance} size="sm" />
        </div>
      </Card>
    </Link>
  );
}
