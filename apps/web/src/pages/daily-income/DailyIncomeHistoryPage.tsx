import { useQuery } from '@tanstack/react-query';
import { CalendarRange, ChevronLeft, ChevronRight, LockKeyhole, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { dailyIncomeApi } from '@/lib/api/daily-income';

const PAGE_SIZE = 30;
type ClosedFilter = 'all' | 'closed';

/**
 * DailyIncomeHistoryPage — Phase 5 Frontend.
 *
 *   • Past days list with from/to date filters + closed-only toggle.
 *   • Each row links to /daily-income/:date (YYYY-MM-DD).
 */
export function DailyIncomeHistoryPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [closedFilter, setClosedFilter] = useState<ClosedFilter>('all');

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      from: from || undefined,
      to: to || undefined,
      closedOnly: closedFilter === 'closed',
    }),
    [page, from, to, closedFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['daily-income', queryParams],
    queryFn: () => dailyIncomeApi.list(queryParams as Parameters<typeof dailyIncomeApi.list>[0]),
  });
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="سجل الإيرادات اليومية">
      <PageHeader
        title="سجل الإيرادات اليومية"
        actions={
          <Link to="/daily-income">
            <Button variant="secondary" size="sm">
              يوم العمل الحالي
            </Button>
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              label="من تاريخ"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              data-testid="daily-history-from"
            />
            <Input
              label="إلى تاريخ"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              data-testid="daily-history-to"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">الحالة</span>
              <select
                value={closedFilter}
                onChange={(e) => {
                  setClosedFilter(e.target.value as ClosedFilter);
                  setPage(1);
                }}
                className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
                aria-label="تصفية حسب حالة اليوم"
                data-testid="daily-history-closed-filter"
              >
                <option value="all">الكل</option>
                <option value="closed">المُقفَلة فقط</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setClosedFilter('all');
                  setPage(1);
                }}
              >
                مسح التصفية
              </Button>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="daily-history-loading">
            {['d0', 'd1', 'd2', 'd3', 'd4'].map((k) => (
              <Skeleton key={k} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل السجل"
            description="حدث خطأ في الشبكة."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="لا توجد سجلات يومية في الفترة المحدَّدة" icon={CalendarRange} />
        ) : (
          <>
            <ul className="space-y-2" data-testid="daily-history-list">
              {data.items.map((d) => {
                const dateOnly = d.date.slice(0, 10); // YYYY-MM-DD
                const closed = !!d.closedAt;
                return (
                  <li key={d.id}>
                    <Link
                      to={`/daily-income/${dateOnly}`}
                      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
                      data-testid={`daily-row-${dateOnly}`}
                    >
                      <Card interactive className="hover:border-primary-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-ink">
                                {new Date(d.date).toLocaleDateString('ar-SA', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              {closed ? (
                                <Badge
                                  variant="neutral"
                                  icon={<LockKeyhole className="h-3 w-3" aria-hidden />}
                                >
                                  مُقفَل
                                </Badge>
                              ) : (
                                <Badge
                                  variant="success"
                                  icon={<Unlock className="h-3 w-3" aria-hidden />}
                                >
                                  مفتوح
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500">
                              افتتاحي: {formatSupplierBalance(toNumber(d.openingCash))} · مبيعات
                              نقدية: {formatSupplierBalance(toNumber(d.cashSales))}
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs text-gray-500">الرصيد المتوقَّع</span>
                            <span className="text-base font-bold tabular-nums text-ink">
                              {formatSupplierBalance(toNumber(d.closingCash))}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 ? (
              <div
                className="flex items-center justify-between"
                data-testid="daily-history-pagination"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                >
                  السابق
                </Button>
                <span className="text-xs text-gray-500">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
                >
                  التالي
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default DailyIncomeHistoryPage;
