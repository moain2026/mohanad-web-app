import { Banknote, CreditCard } from 'lucide-react';

import { Badge } from '@/components/ui';

import type { PurchasePaymentType } from '@/lib/api/purchases';

/**
 * PurchasePaymentBadge — visualises the LOCKED accounting rule for a purchase:
 *   • CASH   → green ("نقد") — supplier balance untouched.
 *   • CREDIT → amber ("آجل") — supplier balance increased atomically.
 */
export interface PurchasePaymentBadgeProps {
  paymentType: PurchasePaymentType;
  className?: string;
}

export function PurchasePaymentBadge({
  paymentType,
  className,
}: PurchasePaymentBadgeProps): JSX.Element {
  if (paymentType === 'CASH') {
    return (
      <Badge
        variant="success"
        icon={<Banknote className="h-3 w-3" aria-hidden />}
        className={className}
      >
        نقد
      </Badge>
    );
  }
  return (
    <Badge
      variant="warning"
      icon={<CreditCard className="h-3 w-3" aria-hidden />}
      className={className}
    >
      آجل
    </Badge>
  );
}
