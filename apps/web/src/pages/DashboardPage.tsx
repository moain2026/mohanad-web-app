import autoAnimate from '@formkit/auto-animate';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Package,
  Plus,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { QuickActionCard } from '@/components/dashboard/QuickActionCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { t } from '@/i18n/ar';
import { http } from '@/lib/http';
import { reportsApi } from '@/lib/api/reports';
import { formatMoney } from '@grocery/shared';

interface HealthPayload {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  database: { status: 'ok' | 'down'; latencyMs: number };
}

interface HealthEnvelope {
  data: HealthPayload;
  meta: { requestId: string | null; timestamp: string; version: string };
}

async function fetchHealth(): Promise<HealthPayload> {
  const res = await http.get<HealthEnvelope>('/api/v1/health');
  return res.data.data;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

/**
 * DashboardPage — landing screen after login.
 * Phase 7: KPIs are now wired to the real `/reports/dashboard` endpoint.
 */
export function DashboardPage(): JSX.Element {
  const quickActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quickActionsRef.current) autoAnimate(quickActionsRef.current);
  }, []);

  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const {
    data: dash,
    isLoading: dashLoading,
    isError: dashError,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard(),
    refetchInterval: 60_000,
  });

  // Build sparkline series from last 7 days
  const sparkSales = dash?.charts.last7Days.map((d) => num(d.sales)) ?? [];
  const sparkExpenses = dash?.charts.last7Days.map((d) => num(d.expenses)) ?? [];
  const sparkNet = dash?.charts.last7Days.map((d) => num(d.net)) ?? [];
  // Debt sparkline isn't tracked daily — use a flat series at current level
  const currentDebt = num(dash?.customers.totalDebt ?? 0);
  const sparkDebts = sparkSales.map(() => currentDebt);

  const stats = [
    {
      label: t('dashboard.todayIncome'),
      value: formatMoney(num(dash?.today.salesTotal ?? 0)),
      delta: dash ? `${dash.today.salesCount} عملية` : '—',
      trend: 'up' as const,
      icon: TrendingUp,
      series: sparkSales,
    },
    {
      label: t('dashboard.todayExpenses'),
      value: formatMoney(num(dash?.today.expenses ?? 0)),
      delta: dash ? `الصندوق: ${formatMoney(num(dash.today.closingCash))}` : '—',
      trend: 'up' as const,
      icon: Wallet,
      iconClassName: 'bg-amber-50 text-amber-700',
      series: sparkExpenses,
    },
    {
      label: t('dashboard.netProfit'),
      value: formatMoney(num(dash?.today.netProfit ?? 0)),
      delta: dash ? `الشهر: ${formatMoney(num(dash.month.netProfit))}` : '—',
      trend: 'up' as const,
      icon: CircleDollarSign,
      iconClassName: 'bg-green-50 text-green-700',
      series: sparkNet,
    },
    {
      label: t('dashboard.customersWithDebt'),
      value: String(dash?.customers.withDebt ?? 0),
      delta: dash ? `إجمالي الديون: ${formatMoney(currentDebt)}` : '—',
      trend: 'down' as const,
      icon: Users,
      iconClassName: 'bg-blue-50 text-blue-700',
      series: sparkDebts,
    },
  ];

  const lowStockCount = dash?.inventory.lowStockCount ?? 0;
  const unreadNotifs = dash?.notifications.unread ?? 0;

  return (
    <AppShell title={t('dashboard.title')}>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('dashboard.title')}
        description="نظرة سريعة على أداء البقالة اليوم — كل القيم من قاعدة البيانات مباشرة."
        actions={
          <Badge variant="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            v0.7.0 — Reports Live
          </Badge>
        }
      />

      {/* Stat grid */}
      <motion.section
        aria-label="مؤشرات الأداء"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 desktop:grid-cols-4 gap-4"
        data-testid="dashboard-kpis"
      >
        {dashLoading
          ? ['s0', 's1', 's2', 's3'].map((k) => <Skeleton key={k} className="h-32 w-full" />)
          : dashError
            ? (
              <div className="col-span-full">
                <Card>
                  <div className="flex items-start gap-3 text-sm text-rose-700">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <p>تعذَّر تحميل مؤشرات الأداء. تأكَّد من أن الـ API يعمل.</p>
                  </div>
                </Card>
              </div>
            )
            : stats.map((s) => (
                <motion.div
                  key={s.label}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
                  }}
                >
                  <StatCard {...s} />
                </motion.div>
              ))}
      </motion.section>

      {/* Alerts strip */}
      {(lowStockCount > 0 || unreadNotifs > 0) && dash ? (
        <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="dashboard-alerts">
          {lowStockCount > 0 ? (
            <Link to="/inventory" className="block">
              <Card className="border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">مخزون منخفض</p>
                    <p className="text-xs text-amber-700">
                      {lowStockCount} منتج بحاجة إلى إعادة الطلب
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ) : null}
          {unreadNotifs > 0 ? (
            <Link to="/notifications" className="block">
              <Card className="border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-800">إشعارات جديدة</p>
                    <p className="text-xs text-blue-700">
                      {unreadNotifs} إشعار لم يُقرأ بعد
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Health + Quick actions */}
      <section className="mt-8 grid grid-cols-1 desktop:grid-cols-3 gap-4">
        <Card header={t('health.label')} className="desktop:col-span-1">
          {healthLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ) : healthError || !health ? (
            <div className="flex items-start gap-3 text-sm text-danger">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <p>تعذّر الاتصال بالـ API. تأكّد أن الخادم يعمل على المنفذ 3001.</p>
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-gray-500">الحالة</span>
                <Badge variant={health.status === 'ok' ? 'success' : 'warning'}>
                  {health.status === 'ok' ? t('health.ok') : t('health.degraded')}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-500">قاعدة البيانات</span>
                <span className="font-mono text-xs">
                  {health.database.status} · {health.database.latencyMs}ms
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-500">الإصدار</span>
                <span className="font-mono text-xs">{health.version}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-500">مدّة التشغيل</span>
                <span className="font-mono text-xs num">{health.uptimeSeconds}s</span>
              </li>
            </ul>
          )}
        </Card>

        <div className="desktop:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-600">
            {t('dashboard.quickActions')}
          </h2>
          <div ref={quickActionsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickActionCard
              label={t('dashboard.quickSale')}
              description="بيع نقدي سريع"
              icon={Receipt}
              tone="primary"
              to="/sales/new"
            />
            <QuickActionCard
              label={t('dashboard.addDebt')}
              description="تسجيل دين على عميل"
              icon={Plus}
              tone="warning"
              to="/customers"
            />
            <QuickActionCard
              label={t('dashboard.recordPayment')}
              description="استلام سداد"
              icon={CircleDollarSign}
              tone="success"
              to="/customers"
            />
            <QuickActionCard
              label={t('dashboard.addExpense')}
              description="تسجيل مصروف يومي"
              icon={UserPlus}
              tone="info"
              to="/expenses/new"
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
