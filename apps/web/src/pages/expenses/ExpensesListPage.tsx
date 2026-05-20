import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlusCircle, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ExpenseCard } from '@/components/expenses';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { type ExpenseType, expensesApi } from '@/lib/api/expenses';

const PAGE_SIZE = 20;

type TypeFilter = 'all' | ExpenseType;
type CancelFilter = 'active' | 'all';

/**
 * ExpensesListPage — Phase 5 Frontend.
 *
 *   • Filter by expense type (all / NORMAL / SUPPLIER_PAYMENT / CASH_PURCHASE_LINK).
 *   • Toggle showing cancelled rows.
 *   • Pagination via API meta.
 *   • Permission-gated "Add" button (expenses.create).
 */
export function ExpensesListPage(): JSX.Element {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('active');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      type: typeFilter === 'all' ? undefined : typeFilter,
      includeCancelled: cancelFilter === 'all',
    }),
    [page, typeFilter, cancelFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => expensesApi.list(queryParams),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="المصروفات">
      <PageHeader
        title="المصروفات"
        actions={
          <PermissionGate permission="expenses.create">
            <Link to="/expenses/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>مصروف جديد</Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TypeFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب نوع المصروف"
              data-testid="expenses-type-filter"
            >
              <option value="all">كل الأنواع</option>
              <option value="NORMAL">عادي</option>
              <option value="SUPPLIER_PAYMENT">دفعة مورّد</option>
              <option value="CASH_PURCHASE_LINK">ربط شراء نقدي</option>
            </select>
            <select
              value={cancelFilter}
              onChange={(e) => {
                setCancelFilter(e.target.value as CancelFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="إظهار الملغاة"
              data-testid="expenses-cancel-filter"
            >
              <option value="active">إخفاء الملغاة</option>
              <option value="all">إظهار الملغاة</option>
            </select>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="expenses-loading">
            {['e0', 'e1', 'e2', 'e3', 'e4'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل قائمة المصروفات"
            description="حدث خطأ في الشبكة. حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا توجد مصروفات بعد"
            description="ابدأ بتسجيل أول مصروف لمتابعة التدفّق النقدي."
            icon={Wallet}
            action={
              <PermissionGate permission="expenses.create">
                <Link to="/expenses/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>
                    تسجيل مصروف
                  </Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="expenses-list">
              {data.items.map((e) => (
                <li key={e.id}>
                  <ExpenseCard expense={e} />
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between" data-testid="expenses-pagination">
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
                  صفحة {page} من {totalPages} — {data.meta.total} مصروف
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

export default ExpensesListPage;
