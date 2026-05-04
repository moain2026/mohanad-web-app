import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * SupplierBalanceDisplay — Phase 4 Frontend.
 *
 * Reuses the same color rules as `BalanceDisplay` but with supplier-oriented
 * labels:
 *   • balance > 0 → red (مدينون له / "we owe")
 *   • balance < 0 → blue (دائن لنا / "supplier owes us — overpayment")
 *   • balance = 0 → green (مسوّى)
 */
export interface SupplierBalanceDisplayProps extends HTMLAttributes<HTMLDivElement> {
  balance: string | number;
  /** Currency suffix (defaults to "ريال"). Pass "" to hide. */
  currency?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function toNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function supplierBalanceTone(value: number): 'owed' | 'overpaid' | 'clear' {
  if (value > 0) return 'owed';
  if (value < 0) return 'overpaid';
  return 'clear';
}

const sizeClasses: Record<NonNullable<SupplierBalanceDisplayProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

const toneClasses: Record<ReturnType<typeof supplierBalanceTone>, string> = {
  owed: 'text-red-600',
  overpaid: 'text-blue-600',
  clear: 'text-green-600',
};

export function formatSupplierBalance(value: number, currency?: string): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const sign = value < 0 ? '−' : '';
  const cur = currency ?? 'ريال';
  return cur ? `${sign}${formatted} ${cur}` : `${sign}${formatted}`;
}

export function SupplierBalanceDisplay({
  balance,
  currency = 'ريال',
  label,
  size = 'md',
  className,
  ...rest
}: SupplierBalanceDisplayProps): JSX.Element {
  const value = toNumber(balance);
  const tone = supplierBalanceTone(value);
  const formatted = formatSupplierBalance(value, currency);

  const labelText =
    label ?? (tone === 'owed' ? 'مدينون له' : tone === 'overpaid' ? 'دائن لنا' : 'الرصيد مسوّى');

  return (
    <div className={cn('flex flex-col gap-0.5', className)} {...rest}>
      <span className="text-xs text-gray-500">{labelText}</span>
      <span
        className={cn('font-bold tabular-nums', sizeClasses[size], toneClasses[tone])}
        data-supplier-balance-tone={tone}
        data-testid="supplier-balance-figure"
      >
        {formatted}
      </span>
    </div>
  );
}
