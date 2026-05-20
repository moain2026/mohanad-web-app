import { useQuery } from '@tanstack/react-query';
import { Calendar, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { reportsApi } from '@/lib/api/reports';
import { formatMoney } from '@grocery/shared';

type ReportSlug =
  | 'daily-summary'
  | 'monthly-summary'
  | 'profit-loss'
  | 'cash-flow'
  | 'customer-debts'
  | 'supplier-balances'
  | 'top-customers'
  | 'top-items'
  | 'expenses-by-category'
  | 'sales-by-mode'
  | 'sales-by-worker';

const LABELS: Record<ReportSlug, string> = {
  'daily-summary': 'ملخص يومي',
  'monthly-summary': 'ملخص شهري',
  'profit-loss': 'الأرباح والخسائر',
  'cash-flow': 'التدفق النقدي',
  'customer-debts': 'تقادم ديون العملاء',
  'supplier-balances': 'أرصدة الموردين',
  'top-customers': 'أفضل العملاء',
  'top-items': 'أكثر الأصناف مبيعاً',
  'expenses-by-category': 'المصاريف حسب الفئة',
  'sales-by-mode': 'المبيعات حسب النمط',
  'sales-by-worker': 'المبيعات حسب العامل',
};

function toIso(d: string): Date | undefined {
  if (!d) return undefined;
  return new Date(`${d}T00:00:00.000Z`);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function thisMonthYM(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

interface ReportTableRow {
  key: string;
  cells: Array<{ label: string; value: string | number; money?: boolean }>;
}

function MoneyRow({ label, value, accent }: { label: string; value: number; accent?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-b-0">
      <span className="text-gray-600">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${accent ?? 'text-ink'}`}>
        {formatMoney(num(value))}
      </span>
    </div>
  );
}

/**
 * ReportDetailPage — Phase 7. Generic renderer for all 11 reports.
 */
export function ReportDetailPage(): JSX.Element {
  const { type } = useParams<{ type: string }>();
  const slug = (type ?? '') as ReportSlug;
  const title = LABELS[slug] ?? 'تقرير';

  // shared date filters
  const [date, setDate] = useState<string>(todayIso());
  const [from, setFrom] = useState<string>(thisMonthStart());
  const [to, setTo] = useState<string>(todayIso());
  const [asOf, setAsOf] = useState<string>(todayIso());
  const [month, setMonth] = useState<string>(thisMonthYM());

  const queryKey = useMemo(
    () => ['report', slug, { date, from, to, asOf, month }],
    [slug, date, from, to, asOf, month],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      switch (slug) {
        case 'daily-summary':
          return reportsApi.dailySummary(toIso(date));
        case 'monthly-summary':
          return reportsApi.monthlySummary(month);
        case 'profit-loss':
          return reportsApi.profitLoss(toIso(from), toIso(to));
        case 'cash-flow':
          return reportsApi.cashFlow(toIso(from), toIso(to));
        case 'customer-debts':
          return reportsApi.customerDebts(toIso(asOf));
        case 'supplier-balances':
          return reportsApi.supplierBalances(toIso(asOf));
        case 'top-customers':
          return reportsApi.topCustomers(toIso(from), toIso(to), 20);
        case 'top-items':
          return reportsApi.topItems(toIso(from), toIso(to), 20);
        case 'expenses-by-category':
          return reportsApi.expensesByCategory(toIso(from), toIso(to));
        case 'sales-by-mode':
          return reportsApi.salesByMode(toIso(from), toIso(to));
        case 'sales-by-worker':
          return reportsApi.salesByWorker(toIso(from), toIso(to));
        default:
          throw new Error('Unknown report');
      }
    },
    enabled: Boolean(LABELS[slug]),
  });

  if (!LABELS[slug]) {
    return (
      <AppShell title="تقرير غير معروف">
        <PageHeader title="تقرير غير معروف" />
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <EmptyState title="هذا التقرير غير متاح" description="عد إلى قائمة التقارير." />
        </div>
      </AppShell>
    );
  }

  // ─── Filter UI per slug ───
  function renderFilters(): JSX.Element {
    if (slug === 'daily-summary') {
      return (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1">التاريخ</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input h-11 rounded-md border border-gray-200 px-3 text-sm"
              data-testid="report-date"
            />
          </label>
        </div>
      );
    }
    if (slug === 'monthly-summary') {
      return (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1">الشهر</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="form-input h-11 rounded-md border border-gray-200 px-3 text-sm"
              data-testid="report-month"
            />
          </label>
        </div>
      );
    }
    if (slug === 'customer-debts' || slug === 'supplier-balances') {
      return (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700 mb-1">بتاريخ</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="form-input h-11 rounded-md border border-gray-200 px-3 text-sm"
              data-testid="report-asof"
            />
          </label>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700 mb-1">من</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="form-input h-11 rounded-md border border-gray-200 px-3 text-sm"
            data-testid="report-from"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700 mb-1">إلى</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="form-input h-11 rounded-md border border-gray-200 px-3 text-sm"
            data-testid="report-to"
          />
        </label>
      </div>
    );
  }

  // ─── Body per slug ───
  function renderBody(): JSX.Element {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {['s0', 's1', 's2', 's3'].map((k) => (
            <Skeleton key={k} className="h-24 w-full" />
          ))}
        </div>
      );
    }
    if (isError || !data) {
      return (
        <EmptyState
          title="تعذَّر تحميل التقرير"
          description="حاول مرة أخرى أو راجع الفترة المحددة."
          action={
            <Button onClick={() => refetch()} variant="secondary">
              إعادة المحاولة
            </Button>
          }
        />
      );
    }

    if (slug === 'daily-summary') {
      const d = data as Awaited<ReturnType<typeof reportsApi.dailySummary>>;
      return (
        <div className="space-y-3">
          <Card header={`اليوم: ${d.date.slice(0, 10)}${d.isClosed ? ' (مُقفل)' : ''}`}>
            <MoneyRow label="الرصيد الافتتاحي" value={num(d.openingCash)} />
            <MoneyRow label="مبيعات نقدية" value={num(d.sales.cashSales)} accent="text-emerald-700" />
            <MoneyRow label="مبيعات آجلة" value={num(d.sales.creditSales)} />
            <MoneyRow label="إجمالي المبيعات" value={num(d.sales.total)} />
            <MoneyRow label="مشتريات نقدية" value={num(d.purchases.cashTotal)} accent="text-rose-700" />
            <MoneyRow label="مدفوعات عملاء" value={num(d.customerPayments)} accent="text-emerald-700" />
            <MoneyRow label="مصاريف عادية" value={num(d.expenses.normal)} accent="text-rose-700" />
            <MoneyRow label="مدفوعات موردين" value={num(d.expenses.supplierPayments)} accent="text-rose-700" />
            <MoneyRow label="الرصيد الختامي" value={num(d.closingCash)} accent="text-primary-700" />
            <MoneyRow label="صافي الربح" value={num(d.netProfit)} accent="text-primary-700" />
          </Card>
        </div>
      );
    }
    if (slug === 'profit-loss') {
      const d = data as Awaited<ReturnType<typeof reportsApi.profitLoss>>;
      return (
        <Card header="الأرباح والخسائر">
          <MoneyRow label="مبيعات نقدية" value={num(d.sales.cashSales)} accent="text-emerald-700" />
          <MoneyRow label="مبيعات آجلة" value={num(d.sales.creditSales)} />
          <MoneyRow label="إجمالي المبيعات" value={num(d.sales.totalSales)} />
          <MoneyRow label="مشتريات نقدية" value={num(d.purchases.cashPurchases)} accent="text-rose-700" />
          <MoneyRow label="مشتريات آجلة" value={num(d.purchases.creditPurchases)} />
          <MoneyRow label="إجمالي المشتريات" value={num(d.purchases.totalPurchases)} />
          <MoneyRow label="مصاريف عادية" value={num(d.expenses.normal)} accent="text-rose-700" />
          <MoneyRow label="الربح الإجمالي" value={num(d.grossProfit)} accent="text-primary-700" />
          <MoneyRow label="الربح الصافي" value={num(d.netProfit)} accent="text-primary-700" />
          {d.isEstimated ? (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              النتائج تقديرية — تعتمد على فواتير الشراء النقدية وليس بطاقات التكلفة لكل صنف.
            </p>
          ) : null}
        </Card>
      );
    }
    if (slug === 'cash-flow') {
      const d = data as Awaited<ReturnType<typeof reportsApi.cashFlow>>;
      return (
        <Card header="التدفق النقدي">
          <h4 className="text-xs font-semibold text-emerald-700 mb-1">داخل</h4>
          <MoneyRow label="مبيعات نقدية" value={num(d.inflows.cashSales)} />
          <MoneyRow label="مدفوعات عملاء" value={num(d.inflows.customerPayments)} />
          <MoneyRow label="إجمالي الداخل" value={num(d.inflows.total)} accent="text-emerald-700" />
          <h4 className="mt-4 text-xs font-semibold text-rose-700 mb-1">خارج</h4>
          <MoneyRow label="مشتريات نقدية" value={num(d.outflows.cashPurchases)} />
          <MoneyRow label="مصاريف عادية" value={num(d.outflows.normalExpenses)} />
          <MoneyRow label="مدفوعات موردين" value={num(d.outflows.supplierPayments)} />
          <MoneyRow label="إجمالي الخارج" value={num(d.outflows.total)} accent="text-rose-700" />
          <MoneyRow label="الصافي" value={num(d.net)} accent="text-primary-700" />
        </Card>
      );
    }
    if (slug === 'customer-debts') {
      const d = data as Awaited<ReturnType<typeof reportsApi.customerDebts>>;
      return (
        <div className="space-y-3">
          <Card header="ملخص التقادم">
            <MoneyRow label="إجمالي العملاء المدينين" value={d.summary.total} />
            <MoneyRow label="إجمالي الديون" value={num(d.summary.totalDebt)} accent="text-rose-700" />
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              {Object.entries(d.summary.byBucket).map(([k, v]) => (
                <div key={k} className="rounded-md bg-gray-50 p-2 text-center">
                  <p className="text-[10px] text-gray-500">{k} يوم</p>
                  <p className="text-sm font-bold text-ink">{v.count}</p>
                  <p className="text-xs text-rose-700">{formatMoney(num(v.debt))}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card header={`القائمة (${d.items.length})`}>
            {d.items.length === 0 ? (
              <p className="text-sm text-gray-500">لا يوجد عملاء مدينون.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.phone ?? '—'} · شريحة {c.bucket} · عمر {c.ageDays} يوم
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-rose-700">
                      {formatMoney(num(c.balance))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      );
    }
    if (slug === 'supplier-balances') {
      const d = data as Awaited<ReturnType<typeof reportsApi.supplierBalances>>;
      return (
        <div className="space-y-3">
          <Card header="الملخص">
            <MoneyRow label="عدد الموردين" value={d.summary.total} />
            <MoneyRow label="موردون لهم رصيد" value={d.summary.suppliersWithBalance} />
            <MoneyRow label="إجمالي المستحق" value={num(d.summary.totalOwed)} accent="text-rose-700" />
          </Card>
          <Card header={`قائمة الموردين (${d.items.length})`}>
            <ul className="divide-y divide-gray-100">
              {d.items.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.phone ?? '—'}</p>
                  </div>
                  <span
                    className={`font-mono font-semibold ${
                      num(s.balance) > 0 ? 'text-rose-700' : 'text-gray-500'
                    }`}
                  >
                    {formatMoney(num(s.balance))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      );
    }
    if (slug === 'top-customers') {
      const d = data as Awaited<ReturnType<typeof reportsApi.topCustomers>>;
      return (
        <Card header={`أفضل ${d.items.length} عميل`}>
          {d.items.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد مبيعات في هذه الفترة.</p>
          ) : (
            <ol className="space-y-1">
              {d.items.map((c, i) => (
                <li
                  key={`${c.customerId ?? 'walk'}-${i}`}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="text-gray-500 me-2">#{i + 1}</span>
                    {c.customerName}
                  </span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatMoney(num(c.salesTotal))} ({c.salesCount})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      );
    }
    if (slug === 'top-items') {
      const d = data as Awaited<ReturnType<typeof reportsApi.topItems>>;
      return (
        <Card header={`أكثر الأصناف مبيعاً (${d.items.length})`}>
          {d.items.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد أصناف.</p>
          ) : (
            <ol className="space-y-1">
              {d.items.map((it, i) => (
                <li
                  key={`${it.name}-${i}`}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="text-gray-500 me-2">#{i + 1}</span>
                    {it.name}
                  </span>
                  <span className="font-mono text-emerald-700">
                    {it.quantity} · {formatMoney(num(it.revenue))}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      );
    }
    if (slug === 'expenses-by-category') {
      const d = data as Awaited<ReturnType<typeof reportsApi.expensesByCategory>>;
      return (
        <Card header={`المصاريف حسب الفئة (${d.items.length})`}>
          <MoneyRow label="الإجمالي" value={num(d.summary.totalAmount)} accent="text-rose-700" />
          <ul className="mt-2 divide-y divide-gray-100">
            {d.items.map((c) => (
              <li key={c.categoryId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-ink">{c.categoryName}</p>
                  <p className="text-xs text-gray-500">
                    {c.count} عملية · {c.percentage.toFixed(1)}٪
                  </p>
                </div>
                <span className="font-mono text-rose-700">{formatMoney(num(c.amount))}</span>
              </li>
            ))}
          </ul>
        </Card>
      );
    }
    if (slug === 'sales-by-mode') {
      const d = data as Awaited<ReturnType<typeof reportsApi.salesByMode>>;
      return (
        <Card header="المبيعات حسب النمط">
          <MoneyRow label="الإجمالي" value={num(d.summary.total)} accent="text-emerald-700" />
          <ul className="mt-2 divide-y divide-gray-100">
            {d.items.map((m) => (
              <li key={m.mode} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-ink">{m.mode}</p>
                  <p className="text-xs text-gray-500">
                    {m.count} عملية · {m.percentage.toFixed(1)}٪
                  </p>
                </div>
                <span className="font-mono text-emerald-700">{formatMoney(num(m.amount))}</span>
              </li>
            ))}
          </ul>
        </Card>
      );
    }
    if (slug === 'sales-by-worker') {
      const d = data as Awaited<ReturnType<typeof reportsApi.salesByWorker>>;
      return (
        <Card header={`أداء البائعين (${d.items.length})`}>
          {d.items.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد مبيعات في هذه الفترة.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {d.items.map((u) => (
                <li key={u.userId} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{u.fullName ?? u.username}</p>
                    <p className="text-xs text-gray-500">{u.username}</p>
                  </div>
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatMoney(num(u.salesTotal))} ({u.salesCount})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      );
    }
    if (slug === 'monthly-summary') {
      const d = data as Awaited<ReturnType<typeof reportsApi.monthlySummary>>;
      return (
        <div className="space-y-3">
          <Card header={`الشهر: ${d.month}`}>
            <MoneyRow label="إجمالي المبيعات" value={num(d.profitLoss.sales.totalSales)} />
            <MoneyRow label="إجمالي المشتريات" value={num(d.profitLoss.purchases.totalPurchases)} />
            <MoneyRow label="المصاريف العادية" value={num(d.profitLoss.expenses.normal)} accent="text-rose-700" />
            <MoneyRow label="الربح الصافي" value={num(d.profitLoss.netProfit)} accent="text-primary-700" />
            <MoneyRow label="صافي التدفق النقدي" value={num(d.cashFlow.net)} accent="text-primary-700" />
          </Card>
          <Card header={`تفصيل يومي (${d.dailyBreakdown.length} يوم)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-start">التاريخ</th>
                    <th className="p-2 text-end">نقدية</th>
                    <th className="p-2 text-end">آجلة</th>
                    <th className="p-2 text-end">مصاريف</th>
                    <th className="p-2 text-end">رصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {d.dailyBreakdown.map((row) => (
                    <tr key={row.date} className={row.isClosed ? '' : 'opacity-70'}>
                      <td className="p-2 font-mono">{row.date.slice(0, 10)}</td>
                      <td className="p-2 text-end font-mono">{formatMoney(num(row.cashSales))}</td>
                      <td className="p-2 text-end font-mono">{formatMoney(num(row.creditSales))}</td>
                      <td className="p-2 text-end font-mono text-rose-700">
                        {formatMoney(num(row.normalExpenses))}
                      </td>
                      <td className="p-2 text-end font-mono">{formatMoney(num(row.closingCash))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );
    }

    return <p>لا يوجد عرض لهذا التقرير.</p>;
  }

  return (
    <AppShell title={title}>
      <PageHeader
        title={title}
        actions={
          <Button
            variant="secondary"
            onClick={() => refetch()}
            isLoading={isFetching}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            تحديث
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>اختر الفترة:</span>
          </div>
          {renderFilters()}
        </Card>
        <div data-testid={`report-body-${slug}`}>{renderBody()}</div>
      </div>
    </AppShell>
  );
}

export default ReportDetailPage;
