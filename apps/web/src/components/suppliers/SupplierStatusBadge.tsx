import { CheckCircle2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui';

/**
 * SupplierStatusBadge — Phase 4 Frontend.
 *
 * Visualises a supplier's `isActive` flag (active vs inactive). Suppliers do
 * NOT have a multi-state lifecycle like customers (no FROZEN / GRACE_PERIOD)
 * so the API surface is intentionally narrower.
 */
export interface SupplierStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

export function SupplierStatusBadge({
  isActive,
  className,
}: SupplierStatusBadgeProps): JSX.Element {
  return isActive ? (
    <Badge
      variant="success"
      icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
      className={className}
    >
      نشط
    </Badge>
  ) : (
    <Badge
      variant="neutral"
      icon={<XCircle className="h-3 w-3" aria-hidden />}
      className={className}
    >
      غير نشط
    </Badge>
  );
}
