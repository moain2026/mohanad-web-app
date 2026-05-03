import { ArrowDownCircle, ArrowUpCircle, Sliders, Sparkles, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

import type { CustomerTransaction, CustomerTransactionType } from '@/lib/api/customers';
import { BalanceDisplay, formatBalance, toNumber } from './BalanceDisplay';

/**
 * TransactionsTimeline — Phase 3 Frontend.
 *
 * Renders a vertical timeline of customer ledger entries. Each row shows:
 *   • icon + label per type (DEBT / PAYMENT / ADJUSTMENT / OPENING)
 *   • amount with proper sign coloring
 *   • running balance after the transaction
 *   • cancel button slot (rendered by parent if user has permission)
 *   • cancelled state visually struck through.
 */
export interface TransactionsTimelineProps {
  items: CustomerTransaction[];
  /** Render-prop for the per-row trailing actions (e.g. Cancel button). */
  rowActions?: (tx: CustomerTransaction) => React.ReactNode;
}

const TYPE_META: Record<
  CustomerTransactionType,
  { label: string; icon: JSX.Element; tone: 'debt' | 'credit' | 'clear' }
> = {
  DEBT: {
    label: 'دين جديد',
    icon: <ArrowUpCircle className="h-4 w-4" aria-hidden />,
    tone: 'debt',
  },
  PAYMENT: {
    label: 'دفعة',
    icon: <ArrowDownCircle className="h-4 w-4" aria-hidden />,
    tone: 'credit',
  },
  ADJUSTMENT: {
    label: 'تسوية',
    icon: <Sliders className="h-4 w-4" aria-hidden />,
    tone: 'clear',
  },
  OPENING: {
    label: 'رصيد افتتاحي',
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
    tone: 'clear',
  },
};

const toneIcon: Record<'debt' | 'credit' | 'clear', string> = {
  debt: 'bg-red-50 text-red-600',
  credit: 'bg-blue-50 text-blue-600',
  clear: 'bg-gray-50 text-gray-600',
};

export function TransactionsTimeline({
  items,
  rowActions,
}: TransactionsTimelineProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        لا توجد حركات بعد على هذا العميل.
      </div>
    );
  }

  return (
    <ol className="space-y-3" data-testid="transactions-timeline">
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
            data-testid={`tx-row-${tx.id}`}
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
                <span>المبلغ: {formatBalance(amountNum)}</span>
                <span>الرصيد بعد: {formatBalance(toNumber(tx.balanceAfter))}</span>
              </div>
            </div>
            {rowActions ? <div className="shrink-0">{rowActions(tx)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}

// Re-export for convenience in tests
export { BalanceDisplay };
