import { CheckCircle2, Clock, Snowflake } from 'lucide-react';

import { Badge } from '@/components/ui';

import type { CustomerStatus } from '@/lib/api/customers';

/**
 * StatusBadge — visualises the Customer.status enum (ACTIVE / FROZEN / GRACE_PERIOD).
 */
export interface StatusBadgeProps {
  status: CustomerStatus;
  graceUntil?: string | null;
  className?: string;
}

const META: Record<
  CustomerStatus,
  { label: string; variant: 'success' | 'warning' | 'danger'; icon: JSX.Element }
> = {
  ACTIVE: {
    label: 'نشط',
    variant: 'success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
  },
  FROZEN: {
    label: 'مجمَّد',
    variant: 'danger',
    icon: <Snowflake className="h-3 w-3" aria-hidden />,
  },
  GRACE_PERIOD: {
    label: 'مهلة سداد',
    variant: 'warning',
    icon: <Clock className="h-3 w-3" aria-hidden />,
  },
};

export function StatusBadge({ status, graceUntil, className }: StatusBadgeProps): JSX.Element {
  const meta = META[status] ?? META.ACTIVE;
  const suffix =
    status === 'GRACE_PERIOD' && graceUntil
      ? ` حتى ${new Date(graceUntil).toLocaleDateString('ar-SA')}`
      : '';
  return (
    <Badge variant={meta.variant} icon={meta.icon} className={className}>
      {meta.label}
      {suffix}
    </Badge>
  );
}
