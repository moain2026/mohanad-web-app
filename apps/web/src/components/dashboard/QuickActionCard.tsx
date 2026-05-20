import { motion } from 'framer-motion';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';

/**
 * QuickActionCard — large tap target shortcut for common operations
 * ("بيع سريع", "إضافة دين", "تسجيل سداد", "إضافة مصروف").
 *
 * Pass `to` for a real React-Router link (preferred for navigation) or
 * `onClick` for an inline action handler. If both are provided, the link
 * wins and `onClick` still fires on activation.
 */
export interface QuickActionCardProps {
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** When set, the card behaves as a `<Link to={...}>` instead of a button. */
  to?: string;
  /** Tailwind classes overriding the icon background tone. */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const toneClasses: Record<NonNullable<QuickActionCardProps['tone']>, string> = {
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
};

const BASE_CLASSES =
  'group relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-4 text-start ' +
  'shadow-card hover:shadow-card-hover transition-all duration-base ease-emphasized';

export function QuickActionCard({
  label,
  description,
  icon: Icon,
  onClick,
  to,
  tone = 'primary',
  className,
}: QuickActionCardProps): JSX.Element {
  const inner = (
    <>
      <div
        className={cn('flex h-12 w-12 items-center justify-center rounded-xl', toneClasses[tone])}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{label}</p>
        {description ? <p className="text-xs text-gray-500 truncate">{description}</p> : null}
      </div>
      <ArrowLeft
        className="h-4 w-4 text-gray-400 transition-transform duration-fast group-hover:-translate-x-0.5"
        aria-hidden
      />
    </>
  );

  if (to) {
    return (
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
        <Link to={to} onClick={onClick} className={cn(BASE_CLASSES, className)}>
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(BASE_CLASSES, className)}
    >
      {inner}
    </motion.button>
  );
}
