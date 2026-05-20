import { Receipt, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';

import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import type { Sale } from '@/lib/api/sales';
import { SaleModeBadge } from './SaleModeBadge';

/**
 * SaleCard — list row card mirroring PurchaseCard but for sales.
 *
 *   • Shows customer (or "نقدي" for QUICK/DETAILED), mode badge, total,
 *     date/time, cancelled state.
 */
export interface SaleCardProps {
  sale: Sale;
}

export function SaleCard({ sale }: SaleCardProps): JSX.Element {
  const cancelled = !!sale.cancelledAt;
  const titleLine = sale.mode === 'CREDIT' ? (sale.customer?.name ?? 'عميل محذوف') : 'بيع نقدي';

  return (
    <Link
      to={`/sales/${sale.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
      data-testid="sale-card"
      data-cancelled={cancelled}
    >
      <Card
        interactive
        className={cancelled ? 'opacity-60 hover:border-gray-200' : 'hover:border-primary-200'}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 shrink-0">
              <Receipt className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">{titleLine}</h3>
                <SaleModeBadge mode={sale.mode} />
                {sale.hasItems ? (
                  <Badge variant="neutral" className="text-[10px]">
                    عناصر
                  </Badge>
                ) : null}
                {cancelled ? (
                  <Badge variant="neutral" icon={<XCircle className="h-3 w-3" aria-hidden />}>
                    ملغاة
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {new Date(sale.createdAt).toLocaleString('ar-SA', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
              {sale.notes ? (
                <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{sale.notes}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-gray-500">الإجمالي</span>
            <span
              className="text-base font-bold tabular-nums text-ink"
              data-testid="sale-card-total"
            >
              {formatSupplierBalance(toNumber(sale.totalAmount))}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
