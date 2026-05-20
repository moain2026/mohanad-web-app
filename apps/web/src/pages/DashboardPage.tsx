import autoAnimate from '@formkit/auto-animate';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { QuickActionCard } from '@/components/dashboard/QuickActionCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { t } from '@/i18n/ar';
import { http } from '@/lib/http';
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

const sample = {
  income: [12, 18, 15, 24, 22, 30, 38, 36, 42, 48, 52, 58],
  expenses: [4, 6, 5, 8, 7, 10, 12, 11, 14, 13, 15, 16],
  net: [8, 12, 10, 16, 15, 20, 26, 25, 28, 35, 37, 42],
  debts: [40, 38, 41, 39, 37, 35, 34, 32, 31, 30, 29, 28],
};

/**
 * DashboardPage — landing screen after login.
 *
 *   • 4 KPI StatCards with sparklines + 3D tilt
 *   • Live system health card driven by /api/v1/health
 *   • 4 QuickActionCards (auto-animated grid)
 *   • Stagger-in animation via Framer Motion
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

  const stats = [
    {
      label: t('dashboard.todayIncome'),
      value: formatMoney(48250),
      delta: '+12.4%',
      trend: 'up' as const,
      icon: TrendingUp,
      series: sample.income,
    },
    {
      label: t('dashboard.todayExpenses'),
      value: formatMoney(12480),
      delta: '+3.2%',
      trend: 'up' as const,
      icon: Wallet,
      iconClassName: 'bg-amber-50 text-amber-700',
      series: sample.expenses,
    },
    {
      label: t('dashboard.netProfit'),
      value: formatMoney(35770),
      delta: '+18.1%',
      trend: 'up' as const,
      icon: CircleDollarSign,
      iconClassName: 'bg-green-50 text-green-700',
      series: sample.net,
    },
    {
      label: t('dashboard.customersWithDebt'),
      value: '28',
      delta: '-4.0%',
      trend: 'down' as const,
      icon: Users,
      iconClassName: 'bg-blue-50 text-blue-700',
      series: sample.debts,
    },
  ];

  return (
    <AppShell title={t('dashboard.title')}>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('dashboard.title')}
        description="نظرة سريعة على أداء البقالة اليوم — كل القيم بالعملة المحلية (YER)."
        actions={
          <Badge variant="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            Foundation v0.1.0
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
      >
        {stats.map((s) => (
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
