import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Globe,
  Laptop,
  LogOut,
  Monitor,
  RefreshCcw,
  Shield,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type AuthSession, authApi } from '@/lib/api/auth';

/**
 * SessionsList — Phase 2 polish.
 *
 * Lists the current user's active sessions (refresh tokens) and lets them
 * revoke individual ones. The session matching the caller's own refresh
 * cookie is flagged with a "هذا الجهاز" badge and cannot be revoked from
 * this UI (we direct them to the global "Logout-all" action instead, which
 * also clears the cookie + redirects to /login).
 */

const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const;

// ─── User-Agent parsing (very light — full UA library would be overkill) ─
function detectDevice(ua: string | null): {
  Icon: typeof Smartphone;
  label: string;
} {
  if (!ua) return { Icon: Globe, label: 'جهاز غير معروف' };
  const lower = ua.toLowerCase();
  if (lower.includes('iphone') || lower.includes('ios')) {
    return { Icon: Smartphone, label: 'iPhone' };
  }
  if (lower.includes('android')) {
    return { Icon: Smartphone, label: 'Android' };
  }
  if (lower.includes('ipad') || lower.includes('tablet')) {
    return { Icon: Monitor, label: 'iPad / Tablet' };
  }
  if (lower.includes('mac')) {
    return { Icon: Laptop, label: 'Mac' };
  }
  if (lower.includes('windows')) {
    return { Icon: Laptop, label: 'Windows' };
  }
  if (lower.includes('linux')) {
    return { Icon: Laptop, label: 'Linux' };
  }
  return { Icon: Globe, label: 'متصفح' };
}

function detectBrowser(ua: string | null): string | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  // Order matters — Edge/Chrome/Safari overlap in UA strings.
  if (lower.includes('edg/')) return 'Edge';
  if (lower.includes('opr/') || lower.includes('opera')) return 'Opera';
  if (lower.includes('firefox')) return 'Firefox';
  if (lower.includes('chrome')) return 'Chrome';
  if (lower.includes('safari')) return 'Safari';
  return null;
}

function formatDateTimeAr(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-EG')} · ${d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

interface SessionRowProps {
  session: AuthSession;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function SessionRow({ session, onRevoke, isRevoking }: SessionRowProps): JSX.Element {
  const { Icon, label: deviceTypeLabel } = detectDevice(session.userAgent);
  const browser = detectBrowser(session.userAgent);
  const deviceLabel = session.deviceLabel || deviceTypeLabel;
  const deviceSub = browser ? `${deviceTypeLabel} · ${browser}` : deviceTypeLabel;

  return (
    <li
      data-testid={`session-row-${session.id}`}
      data-current={session.current ? 'true' : 'false'}
      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border border-gray-100 bg-white p-3 sm:p-4"
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          session.current ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-500'
        }`}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{deviceLabel}</span>
          {session.current ? (
            <Badge variant="success" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
              هذا الجهاز
            </Badge>
          ) : null}
          {session.rememberMe ? <Badge variant="neutral">جلسة طويلة</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3 w-3" aria-hidden />
            {deviceSub}
          </span>
          {session.ipAddress ? (
            <span dir="ltr" className="inline-flex items-center gap-1 font-mono">
              <Globe className="h-3 w-3" aria-hidden />
              {session.ipAddress}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            بدأت: {formatDateTimeAr(session.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            تنتهي: {formatDateTimeAr(session.expiresAt)}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {session.current ? (
          <span className="text-xs text-gray-400">لإنهاء هذا الجهاز استخدم «تسجيل الخروج»</span>
        ) : (
          <Button
            data-testid={`revoke-session-${session.id}`}
            variant="danger"
            size="sm"
            leftIcon={<LogOut className="h-4 w-4" />}
            isLoading={isRevoking}
            onClick={() => onRevoke(session.id)}
          >
            إنهاء الجلسة
          </Button>
        )}
      </div>
    </li>
  );
}

export function SessionsList(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();
  const [pendingRevoke, setPendingRevoke] = useState<AuthSession | null>(null);

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => authApi.listSessions(),
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: async () => {
      toast.success('تم إنهاء الجلسة بنجاح');
      await qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast.error(e.message ?? 'تعذر إنهاء الجلسة');
    },
    onSettled: () => setPendingRevoke(null),
  });

  const handleConfirmRevoke = (): void => {
    if (pendingRevoke) {
      revokeMutation.mutate(pendingRevoke.id);
    }
  };

  const sessions = sessionsQuery.data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.075 }}
    >
      <Card
        header={
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary-600" aria-hidden />
              الجلسات النشطة
              {sessions.length > 0 ? (
                <Badge variant="neutral" data-testid="sessions-count-badge">
                  {sessions.length}
                </Badge>
              ) : null}
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => sessionsQuery.refetch()}
              disabled={sessionsQuery.isFetching}
              data-testid="sessions-refresh"
            >
              تحديث
            </Button>
          </div>
        }
      >
        {sessionsQuery.isLoading ? (
          <ul className="space-y-2" data-testid="sessions-loading">
            <li>
              <Skeleton className="h-14 w-full rounded-xl" />
            </li>
            <li>
              <Skeleton className="h-14 w-full rounded-xl" />
            </li>
            <li>
              <Skeleton className="h-14 w-full rounded-xl" />
            </li>
          </ul>
        ) : sessionsQuery.isError ? (
          <EmptyState
            icon={Shield}
            title="تعذر تحميل الجلسات"
            description={extractApiError(sessionsQuery.error).message ?? 'حاول التحديث مجدداً.'}
            action={
              <Button variant="ghost" size="sm" onClick={() => sessionsQuery.refetch()}>
                إعادة المحاولة
              </Button>
            }
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="لا توجد جلسات نشطة"
            description="ستظهر هنا أي جلسة سجلت دخولاً منها."
          />
        ) : (
          <div className="space-y-3" data-testid="sessions-list">
            <p className="text-xs text-gray-500">
              عرض {sessions.length} جلسة نشطة
              {otherCount > 0 ? ` — منها ${otherCount} على أجهزة أخرى` : ''}.
            </p>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isRevoking={revokeMutation.isPending && pendingRevoke?.id === s.id}
                  onRevoke={() => setPendingRevoke(s)}
                />
              ))}
            </ul>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="إنهاء الجلسة؟"
        message={
          pendingRevoke ? (
            <span>
              سيتم إنهاء جلسة هذا الجهاز
              {pendingRevoke.deviceLabel ? ` (${pendingRevoke.deviceLabel})` : ''} فوراً وسيُطلب منه
              إعادة تسجيل الدخول.
            </span>
          ) : null
        }
        confirmLabel="إنهاء الجلسة"
        intent="danger"
        isLoading={revokeMutation.isPending}
        onClose={() => {
          if (!revokeMutation.isPending) setPendingRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
      />
    </motion.div>
  );
}
