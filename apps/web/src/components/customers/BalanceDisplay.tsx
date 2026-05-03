import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * BalanceDisplay — Phase 3 Frontend (P3-FE).
 *
 * Renders a customer balance with semantic coloring:
 *   • balance > 0  → red (مدين / debt)
 *   • balance < 0  → blue (دائن / credit)
 *   • balance = 0  → green (صفر / clear)
 *
 * The component accepts numbers OR Decimal-as-string (the API returns strings).
 * Numbers are formatted with the Arabic locale and a configurable currency tag
 * ("ريال" by default). The balance label can be overridden for previews.
 */
export interface BalanceDisplayProps extends HTMLAttributes<HTMLDivElement> {
  balance: string | number;
  /** Currency suffix (defaults to "ريال"). Pass "" to hide. */
  currency?: string;
  /** Override label above the figure. */
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show ± sign explicitly (default: only for negatives). */
  showSign?: boolean;
}

export function toNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function balanceTone(value: number): 'debt' | 'credit' | 'clear' {
  if (value > 0) return 'debt';
  if (value < 0) return 'credit';
  return 'clear';
}

const sizeClasses: Record<NonNullable<BalanceDisplayProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

const toneClasses: Record<ReturnType<typeof balanceTone>, string> = {
  debt: 'text-red-600',
  credit: 'text-blue-600',
  clear: 'text-green-600',
};

export function formatBalance(
  value: number,
  { showSign, currency }: { showSign?: boolean; currency?: string } = {},
): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const sign = value < 0 ? '−' : showSign && value > 0 ? '+' : '';
  const cur = currency ?? 'ريال';
  return cur ? `${sign}${formatted} ${cur}` : `${sign}${formatted}`;
}

export function BalanceDisplay({
  balance,
  currency = 'ريال',
  label,
  size = 'md',
  showSign = false,
  className,
  ...rest
}: BalanceDisplayProps): JSX.Element {
  const value = toNumber(balance);
  const tone = balanceTone(value);
  const formatted = formatBalance(value, { showSign, currency });

  const labelText = label ?? (tone === 'debt' ? 'مدين' : tone === 'credit' ? 'دائن' : 'الرصيد صفر');

  return (
    <div className={cn('flex flex-col gap-0.5', className)} {...rest}>
      <span className="text-xs text-gray-500">{labelText}</span>
      <span
        className={cn('font-bold tabular-nums', sizeClasses[size], toneClasses[tone])}
        data-balance-tone={tone}
        data-testid="balance-figure"
      >
        {formatted}
      </span>
    </div>
  );
}
