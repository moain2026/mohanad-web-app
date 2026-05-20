import {
  BarChart3,
  CalendarDays,
  Coins,
  CreditCard,
  Factory,
  type LucideIcon,
  Package,
  PieChart,
  Receipt,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

interface ReportCard {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: string;
  tone: string;
}

const REPORTS: ReportCard[] = [
  {
    slug: 'daily-summary',
    label: 'ملخص يومي',
    description: 'إجمالي اليوم: مبيعات نقدية/آجلة، مصاريف، إيرادات صافية.',
    icon: CalendarDays,
    permission: 'reports.daily_summary_view',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    slug: 'monthly-summary',
    label: 'ملخص شهري',
    description: 'تفصيل يومي مع أرباح وخسائر وتدفق نقدي للشهر.',
    icon: BarChart3,
    permission: 'reports.monthly_summary_view',
    tone: 'bg-sky-50 text-sky-700',
  },
  {
    slug: 'profit-loss',
    label: 'الأرباح والخسائر',
    description: 'الإيرادات مقابل المصاريف خلال فترة محدَّدة.',
    icon: TrendingUp,
    permission: 'reports.profit_loss_view',
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    slug: 'cash-flow',
    label: 'التدفق النقدي',
    description: 'الداخل والخارج من الصندوق.',
    icon: Wallet,
    permission: 'reports.cash_flow_view',
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    slug: 'customer-debts',
    label: 'تقادم ديون العملاء',
    description: 'تصنيف الديون حسب العمر (0-30، 31-60، …).',
    icon: CreditCard,
    permission: 'reports.customer_debts_view',
    tone: 'bg-rose-50 text-rose-700',
  },
  {
    slug: 'supplier-balances',
    label: 'أرصدة الموردين',
    description: 'إجمالي ما هو مستحق للموردين.',
    icon: Factory,
    permission: 'reports.supplier_balances_view',
    tone: 'bg-orange-50 text-orange-700',
  },
  {
    slug: 'top-customers',
    label: 'أفضل العملاء',
    description: 'العملاء الأكثر شراءً خلال فترة.',
    icon: Trophy,
    permission: 'reports.top_customers_view',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    slug: 'top-items',
    label: 'أكثر الأصناف مبيعاً',
    description: 'أصناف المبيعات الأكثر طلباً (للأنماط التفصيلية).',
    icon: Package,
    permission: 'reports.top_items_view',
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    slug: 'expenses-by-category',
    label: 'المصاريف حسب الفئة',
    description: 'توزيع المصاريف على الفئات.',
    icon: PieChart,
    permission: 'reports.expenses_by_category_view',
    tone: 'bg-pink-50 text-pink-700',
  },
  {
    slug: 'sales-by-mode',
    label: 'المبيعات حسب النمط',
    description: 'سريع / تفصيلي / آجل — كم بكل نمط.',
    icon: Receipt,
    permission: 'reports.sales_by_mode_view',
    tone: 'bg-cyan-50 text-cyan-700',
  },
  {
    slug: 'sales-by-worker',
    label: 'المبيعات حسب العامل',
    description: 'أداء البائعين خلال الفترة.',
    icon: Users,
    permission: 'reports.sales_by_worker_view',
    tone: 'bg-indigo-50 text-indigo-700',
  },
];

export function ReportsListPage(): JSX.Element {
  return (
    <AppShell title="التقارير">
      <PageHeader
        title="التقارير"
        description="11 تقريراً تفصيلياً مدعومة ببيانات مباشرة من قاعدة البيانات."
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.slug}
                to={`/reports/${r.slug}`}
                className="block"
                data-testid={`report-link-${r.slug}`}
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${r.tone}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-ink">{r.label}</h3>
                      <p className="mt-1 text-xs text-gray-600 leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          <Coins className="inline h-3.5 w-3.5 me-1" />
          القيم تُعرض بعملة المتجر الافتراضية. يمكن تخصيص العملة من الإعدادات.
        </p>
      </div>
    </AppShell>
  );
}

export default ReportsListPage;
