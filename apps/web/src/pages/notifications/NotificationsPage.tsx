import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { type Notification, notificationsApi } from '@/lib/api/notifications';
import { cn } from '@/lib/cn';

/**
 * NotificationsPage — list user notifications with mark-read actions.
 *
 *   • Renders read/unread items with visual differentiation.
 *   • Per-row "Mark as read" + global "Mark all read" buttons.
 *   • Auto-invalidates the bell unread-count after mutations.
 */
export function NotificationsPage(): JSX.Element {
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ page: 1, limit: 50 }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (res) => {
      toast.success(`تم تعليم ${res.updated} إشعار كمقروء`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <AppShell title="الإشعارات">
      <PageHeader
        title="الإشعارات"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCheck className="h-4 w-4" aria-hidden />}
              isLoading={markAll.isPending}
              onClick={() => markAll.mutate()}
              data-testid="btn-mark-all-read"
            >
              تعليم الكل كمقروء ({unreadCount})
            </Button>
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {['n0', 'n1', 'n2', 'n3', 'n4'].map((k) => (
              <Skeleton key={k} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="لا توجد إشعارات"
            description="ستظهر هنا إشعارات تجاوز سقف الائتمان وتنبيهات النظام."
          />
        ) : (
          <ul className="space-y-2" data-testid="notifications-list">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow
                  n={n}
                  onMarkRead={() => markRead.mutate(n.id)}
                  isMarking={markRead.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function NotificationRow({
  n,
  onMarkRead,
  isMarking,
}: {
  n: Notification;
  onMarkRead: () => void;
  isMarking: boolean;
}): JSX.Element {
  const isUnread = !n.readAt;
  return (
    <Card
      className={cn(isUnread ? 'border-primary-200 bg-primary-50/30' : '')}
      data-testid={`notification-${n.id}`}
      data-unread={isUnread}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-ink truncate">{n.title}</h3>
            {isUnread ? (
              <Badge variant="primary" className="shrink-0">
                جديد
              </Badge>
            ) : null}
            <span className="text-[11px] text-gray-400 shrink-0">
              {new Date(n.sentAt).toLocaleString('ar-SA')}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600 break-words">{n.body}</p>
        </div>
        {isUnread ? (
          <Button
            variant="ghost"
            size="sm"
            isLoading={isMarking}
            onClick={onMarkRead}
            leftIcon={<Check className="h-4 w-4" aria-hidden />}
            data-testid={`btn-mark-read-${n.id}`}
          >
            تعليم كمقروء
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export default NotificationsPage;
