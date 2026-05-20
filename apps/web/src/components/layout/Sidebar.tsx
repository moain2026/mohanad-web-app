import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { t } from '@/i18n/ar';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

/**
 * Sidebar — desktop (≥768 px) primary navigation.
 *
 * Visible only on `desktop:` breakpoint; mobile uses <BottomNav>.
 * Items are filtered by the current user's permissions (mirrors the
 * BottomNav semantics): if the user lacks the listed permission(s)
 * the item is hidden. Items without `permission` / `anyOf` / `allOf`
 * are always visible.
 */
export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Single permission code that must be present. */
  permission?: string;
  /** ANY of these codes is sufficient. */
  anyOf?: string[];
  /** ALL of these codes must be present. */
  allOf?: string[];
  /** Optional section heading rendered above this item. */
  sectionLabel?: string;
}

export interface SidebarProps {
  items?: SidebarItem[];
  onLogout?: () => void;
  className?: string;
}

const defaultItems: SidebarItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  {
    to: '/customers',
    label: 'العملاء',
    icon: Users,
    anyOf: ['customers.view', 'customer_transactions.view'],
  },
  { to: '/sales', label: 'المبيعات', icon: Receipt, anyOf: ['sales.view', 'sales.create'] },
  { to: '/suppliers', label: 'الموردون', icon: Truck, permission: 'suppliers.view' },
  { to: '/purchases', label: 'المشتريات', icon: ShoppingCart, permission: 'purchases.view' },
  {
    to: '/expenses',
    label: 'المصاريف',
    icon: Wallet,
    anyOf: ['expenses.view', 'expense_categories.view'],
  },
  { to: '/reports', label: 'التقارير', icon: BarChart3, permission: 'reports.view' },
  { to: '/settings', label: 'الإعدادات', icon: Settings, permission: 'system.settings.view' },
  // ─── Admin section ───
  {
    to: '/admin/users',
    label: 'المستخدمون',
    icon: UsersRound,
    permission: 'users.view',
    sectionLabel: 'الإدارة',
  },
  { to: '/admin/roles', label: 'الأدوار والصلاحيات', icon: ShieldCheck, permission: 'roles.view' },
  // ─── Account ───
  { to: '/account', label: 'حسابي', icon: UserCircle, sectionLabel: 'الحساب' },
  {
    to: '/notifications',
    label: 'الإشعارات',
    icon: Bell,
    permission: 'notifications.view_own',
  },
];

export function Sidebar({ items = defaultItems, onLogout, className }: SidebarProps): JSX.Element {
  const { pathname } = useLocation();
  const { isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions } = useAuthStore();

  const visibleItems = useMemo(() => {
    if (!isAuthenticated) return items.filter((i) => !i.permission && !i.anyOf && !i.allOf);
    return items.filter((i) => {
      if (i.permission && !hasPermission(i.permission)) return false;
      if (i.anyOf && !hasAnyPermission(i.anyOf)) return false;
      if (i.allOf && !hasAllPermissions(i.allOf)) return false;
      return true;
    });
  }, [items, isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions]);

  return (
    <aside
      aria-label="التنقل الجانبي"
      className={cn(
        'hidden desktop:flex flex-col w-64 shrink-0 border-l border-gray-200 bg-surface/85 backdrop-blur',
        'sticky top-0 h-screen',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-emerald text-primary-800 font-bold shadow-glow">
          ب
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-ink">{t('app.name')}</p>
          <p className="text-xs text-gray-500">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.to || (item.to !== '/' && pathname.startsWith(`${item.to}/`));
          return (
            <div key={item.to}>
              {item.sectionLabel ? (
                <p className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  {item.sectionLabel}
                </p>
              ) : null}
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
