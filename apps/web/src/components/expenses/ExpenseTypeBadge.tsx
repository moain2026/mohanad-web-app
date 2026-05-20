import { Banknote, Link2, Wallet } from 'lucide-react';

import { Badge } from '@/components/ui';

import type { ExpenseType } from '@/lib/api/expenses';

/**
 * ExpenseTypeBadge — visualises the locked 3-mode rule for an expense:
 *   • NORMAL              → neutral ("عادي") — affects normal_expenses.
 *   • SUPPLIER_PAYMENT    → amber ("دفعة مورّد") — atomic SupplierTransaction.
 *   • CASH_PURCHASE_LINK  → blue ("ربط شراء نقدي") — no double-count; the
 *                            real ledger is the linked Purchase row.
 */
export interface ExpenseTypeBadgeProps {
  type: ExpenseType;
  className?: string;
}

export function ExpenseTypeBadge({ type, className }: ExpenseTypeBadgeProps): JSX.Element {
  switch (type) {
    case 'NORMAL':
      return (
        <Badge
          variant="neutral"
          icon={<Wallet className="h-3 w-3" aria-hidden />}
          className={className}
        >
          عادي
        </Badge>
      );
    case 'SUPPLIER_PAYMENT':
      return (
        <Badge
          variant="warning"
          icon={<Banknote className="h-3 w-3" aria-hidden />}
          className={className}
        >
          دفعة مورّد
        </Badge>
      );
    case 'CASH_PURCHASE_LINK':
      return (
        <Badge
          variant="credit"
          icon={<Link2 className="h-3 w-3" aria-hidden />}
          className={className}
        >
          ربط شراء نقدي
        </Badge>
      );
  }
}
