import { motion } from 'framer-motion';
import {
  Bell,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

/**
 * BottomNav — Phase 2 P2-5 dynamic bottom-tab navigation.
 *
 *   • Each tab declares its required permission(s) using the same
 *     contract as `PermissionGate` (`permission` / `anyOf` / `allOf`).
 *   • The store filter strips tabs the current user can't access.
 *   • At most 5 tabs are rendered. The tail-end "More" tab is always
 *     present (overflow / settings menu) — when the visible set exceeds
 *     `max - 1` real tabs the surplus is collapsed behind it.
 *
 * The default catalogue covers every business-domain tab; the call site
 * can override via `items` (storybook, unit tests, edge cases).
 */
export interface BottomNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
}

export interface BottomNavProps {
  items?: BottomNavItem[];
  className?: string;
  /** Maximum number of tabs to render (default 5). */
  max?: number;
}

const defaultItems: BottomNavItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/sales', label: 'المبيعات', icon: Receipt, anyOf: ['sales.view', 'sales.create'] },
  {
    to: '/customers',
    label: 'العملاء',
    icon: Users,
    anyOf: ['customers.view', 'customer_transactions.view'],
  },
  {
    to: '/purchases',
    label: 'المشتريات',
    icon: Truck,
    anyOf: ['purchases.view', 'suppliers.view'],
  },
  {
    to: '/expenses',
    label: 'المصاريف',
    icon: Wallet,
    anyOf: ['expenses.view', 'expense_categories.manage'],
  },
  {
    to: '/inventory',
    label: 'المخزون',
    icon: Package,
    anyOf: ['inventory.view', 'products.view'],
  },
  {
    to: '/notifications',
    label: 'الإشعارات',
    icon: Bell,
    permission: 'notifications.view_own',
  },
];

export function BottomNav({
  items = defaultItems,
  className,
  max = 5,
}: BottomNavProps): JSX.Element {
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const hasAllPermissions = useAuthStore((s) => s.hasAllPermissions);

  const visible = useMemo(() => {
    if (!isAuthenticated) return items.filter((i) => !i.permission && !i.anyOf && !i.allOf);
    return items.filter((i) => {
      if (i.permission && !hasPermission(i.permission)) return false;
      if (i.anyOf && !hasAnyPermission(i.anyOf)) return false;
      if (i.allOf && !hasAllPermissions(i.allOf)) return false;
      return true;
    });
  }, [items, isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions]);

  // Cap the rendered set at `max` entries.
  const displayed = useMemo<BottomNavItem[]>(() => visible.slice(0, max), [visible, max]);

  return (
    <nav
      aria-label="التنقل السفلي"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 desktop:hidden',
        'border-t border-gray-200 bg-surface/95 backdrop-blur',
        'h-16 px-2',
        className,
      )}
    >
      <ul
        className="grid h-full items-stretch"
        style={{ gridTemplateColumns: `repeat(${displayed.length}, minmax(0, 1fr))` }}
      >
        {displayed.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.to} className="flex">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                data-testid={`bottom-nav-${item.to.replace('/', '')}`}
                className={cn(
                  'group relative flex w-full flex-col items-center justify-center gap-1',
                  'text-xs font-medium transition-colors duration-fast',
                  active ? 'text-primary-700' : 'text-gray-500 hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
                {active ? (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-primary-600"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
