import { CreditCard, ListChecks, Zap } from 'lucide-react';

import { Badge } from '@/components/ui';
import type { SaleMode } from '@/lib/api/sales';

/**
 * SaleModeBadge — visualises the locked 3-mode rule for a sale:
 *
 *   • QUICK     → neutral ("بيع سريع")  — cash, total-only, no items.
 *   • DETAILED  → success ("بيع مُفصَّل") — cash, items optional.
 *   • CREDIT    → credit ("آجل")        — customer-bound; atomic DEBT.
 */
export interface SaleModeBadgeProps {
  mode: SaleMode;
  className?: string;
}

export function SaleModeBadge({ mode, className }: SaleModeBadgeProps): JSX.Element {
  switch (mode) {
    case 'QUICK':
      return (
        <Badge
          variant="neutral"
          icon={<Zap className="h-3 w-3" aria-hidden />}
          className={className}
        >
          سريع
        </Badge>
      );
    case 'DETAILED':
      return (
        <Badge
          variant="success"
          icon={<ListChecks className="h-3 w-3" aria-hidden />}
          className={className}
        >
          مُفصَّل
        </Badge>
      );
    case 'CREDIT':
      return (
        <Badge
          variant="credit"
          icon={<CreditCard className="h-3 w-3" aria-hidden />}
          className={className}
        >
          آجل
        </Badge>
      );
  }
}
