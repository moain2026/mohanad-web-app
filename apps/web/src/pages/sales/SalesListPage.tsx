import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlusCircle, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { SaleCard } from '@/components/sales';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { type SaleMode, salesApi } from '@/lib/api/sales';

const PAGE_SIZE = 20;

type ModeFilter = 'all' | SaleMode;
type CancelFilter = 'active' | 'all';

/**
 * SalesListPage — Phase 6 Frontend.
 *
 *   • Filter by sale mode (all / QUICK / DETAILED / CREDIT).
 *   • Toggle showing cancelled rows.
 *   • Pagination via API meta.
 *   • Permission-gated "Add" button (sales.create).
 */
export function SalesListPage(): JSX.Element {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('active');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      mode: modeFilter === 'all' ? undefined : modeFilter,
      includeCancelled: cancelFilter === 'all',
    }),
    [page, modeFilter, cancelFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales', queryParams],
    queryFn: () => salesApi.list(queryParams),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="المبيعات">
      <PageHeader
        title="المبيعات"
        actions={
          <PermissionGate permission="sales.create">
            <Link to="/sales/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>بيع جديد</Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value as ModeFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب نوع البيع"
              data-testid="sales-mode-filter"
            >
              <option value="all">كل الأنواع</option>
              <option value="QUICK">بيع سريع</option>
              <option value="DETAILED">بيع مُفصَّل</option>
              <option value="CREDIT">بيع آجل</option>
            </select>
            <select
              value={cancelFilter}
              onChange={(e) => {
                setCancelFilter(e.target.value as CancelFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="إظهار الملغاة"
              data-testid="sales-cancel-filter"
            >
              <option value="active">إخفاء الملغاة</option>
              <option value="all">إظهار الملغاة</option>
            </select>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="sales-loading">
            {['s0', 's1', 's2', 's3', 's4'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل قائمة المبيعات"
            description="حدث خطأ في الشبكة. حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا توجد عمليات بيع بعد"
            description="ابدأ بتسجيل أول عملية بيع."
            icon={Receipt}
            action={
              <PermissionGate permission="sales.create">
                <Link to="/sales/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>
                    تسجيل بيع
                  </Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="sales-list">
              {data.items.map((s) => (
                <li key={s.id}>
                  <SaleCard sale={s} />
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between" data-testid="sales-pagination">
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
                  صفحة {page} من {totalPages} — {data.meta.total} عملية
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

export default SalesListPage;
