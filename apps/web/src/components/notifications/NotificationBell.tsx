import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

import { notificationsApi } from '@/lib/api/notifications';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

/**
 * NotificationBell — Phase 3 Frontend.
 *
 *   • Fetches unread count every 60s (refetchInterval) with 30s staleTime.
 *   • Renders a small badge with the unread count (capped at "9+").
 *   • Navigates to /notifications on click.
 *   • Hidden when the user lacks the `notifications.view_own` permission.
 */
export interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps): JSX.Element | null {
  const { isAuthenticated, hasPermission } = useAuthStore();

  const enabled = isAuthenticated && hasPermission('notifications.view_own');

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const count = data?.count ?? 0;
  const badge = count > 9 ? '9+' : count > 0 ? String(count) : null;

  return (
    <Link
      to="/notifications"
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-500',
        className,
      )}
      aria-label={count > 0 ? `لديك ${count} إشعار غير مقروء` : 'الإشعارات'}
      data-testid="notification-bell"
      data-count={count}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {badge ? (
        <span
          className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          data-testid="notification-bell-badge"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
