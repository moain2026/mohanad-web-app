import { ShoppingCart, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';

import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import type { Purchase } from '@/lib/api/purchases';
import { PurchasePaymentBadge } from './PurchasePaymentBadge';

/**
 * PurchaseCard — list-row card for the purchases list page.
 *
 *   • Shows supplier name, payment type (CASH/CREDIT), total, date.
 *   • Visually marks cancelled rows with reduced opacity + badge.
 */
export interface PurchaseCardProps {
  purchase: Purchase;
}

export function PurchaseCard({ purchase }: PurchaseCardProps): JSX.Element {
  const cancelled = !!purchase.cancelledAt;
  return (
    <Link
      to={`/purchases/${purchase.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
      data-testid="purchase-card"
      data-cancelled={cancelled}
    >
      <Card
        interactive
        className={cancelled ? 'opacity-60 hover:border-gray-200' : 'hover:border-primary-200'}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600 shrink-0">
              <ShoppingCart className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">
                  {purchase.supplier?.name ?? 'مورّد محذوف'}
                </h3>
                <PurchasePaymentBadge paymentType={purchase.paymentType} />
                {cancelled ? (
                  <Badge variant="neutral" icon={<XCircle className="h-3 w-3" aria-hidden />}>
                    ملغاة
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {new Date(purchase.createdAt).toLocaleString('ar-SA')}
                {purchase.hasItems ? ' • تتضمن أصنافاً' : ' • إجمالي فقط'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-gray-500">الإجمالي</span>
            <span
              className="text-base font-bold tabular-nums text-ink"
              data-testid="purchase-card-total"
            >
              {formatSupplierBalance(toNumber(purchase.totalAmount))}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
