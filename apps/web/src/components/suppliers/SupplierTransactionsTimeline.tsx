import {
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

import type { SupplierTransaction, SupplierTransactionType } from '@/lib/api/suppliers';
import { formatSupplierBalance, toNumber } from './SupplierBalanceDisplay';

/**
 * SupplierTransactionsTimeline — Phase 4 Frontend.
 *
 * Vertical timeline for the supplier ledger. Each row shows:
 *   • icon + label per type (OPENING / CREDIT_PURCHASE / PAYMENT / ADJUSTMENT)
 *   • amount with sign-aware coloring
 *   • running balance after the transaction
 *   • cancel button slot (rendered by parent if user has permission)
 *   • cancelled state visually struck through.
 */
export interface SupplierTransactionsTimelineProps {
  items: SupplierTransaction[];
  /** Render-prop for the per-row trailing actions (e.g. Cancel button). */
  rowActions?: (tx: SupplierTransaction) => React.ReactNode;
}

const TYPE_META: Record<
  SupplierTransactionType,
  { label: string; icon: JSX.Element; tone: 'owed' | 'paid' | 'neutral' }
> = {
  OPENING: {
    label: 'رصيد افتتاحي',
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
    tone: 'neutral',
  },
  CREDIT_PURCHASE: {
    label: 'شراء آجل',
    icon: <ShoppingCart className="h-4 w-4" aria-hidden />,
    tone: 'owed',
  },
  PAYMENT: {
    label: 'دفعة للمورّد',
    icon: <ArrowDownCircle className="h-4 w-4" aria-hidden />,
    tone: 'paid',
  },
  ADJUSTMENT: {
    label: 'تسوية',
    icon: <Sliders className="h-4 w-4" aria-hidden />,
    tone: 'neutral',
  },
};

const toneIcon: Record<'owed' | 'paid' | 'neutral', string> = {
  owed: 'bg-red-50 text-red-600',
  paid: 'bg-blue-50 text-blue-600',
  neutral: 'bg-gray-50 text-gray-600',
};

export function SupplierTransactionsTimeline({
  items,
  rowActions,
}: SupplierTransactionsTimelineProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500"
        data-testid="supplier-timeline-empty"
      >
        لا توجد حركات بعد على هذا المورّد.
      </div>
    );
  }

  return (
    <ol className="space-y-3" data-testid="supplier-transactions-timeline">
      {items.map((tx) => {
        const meta = TYPE_META[tx.type] ?? TYPE_META.ADJUSTMENT;
        const cancelled = !!tx.cancelledAt;
        const amountNum = toNumber(tx.amount);
        return (
          <li
            key={tx.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3',
              cancelled && 'opacity-60',
            )}
            data-testid={`supplier-tx-row-${tx.id}`}
            data-cancelled={cancelled}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                toneIcon[meta.tone],
              )}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-ink">{meta.label}</span>
                {cancelled ? (
                  <Badge variant="neutral" icon={<XCircle className="h-3 w-3" aria-hidden />}>
                    ملغاة
                  </Badge>
                ) : null}
                <span className="text-xs text-gray-500">
                  {new Date(tx.createdAt).toLocaleString('ar-SA')}
                </span>
              </div>
              {tx.notes ? (
                <p className="mt-1 text-xs text-gray-600 break-words">{tx.notes}</p>
              ) : null}
              {cancelled && tx.cancelReason ? (
                <p className="mt-1 text-xs text-red-600">سبب الإلغاء: {tx.cancelReason}</p>
              ) : null}
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span>المبلغ: {formatSupplierBalance(amountNum)}</span>
                <span>الرصيد بعد: {formatSupplierBalance(toNumber(tx.balanceAfter))}</span>
              </div>
            </div>
            {rowActions ? <div className="shrink-0">{rowActions(tx)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
