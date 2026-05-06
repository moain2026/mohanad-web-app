import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlusCircle, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PurchaseCard } from '@/components/purchases';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { purchasesApi } from '@/lib/api/purchases';

const PAGE_SIZE = 20;

type PaymentFilter = 'all' | 'CASH' | 'CREDIT';
type CancelFilter = 'active' | 'all';

/**
 * PurchasesListPage — Phase 4 Frontend.
 *
 *   • Filter by payment type (all / CASH / CREDIT).
 *   • Toggle showing cancelled rows.
 *   • Pagination via API meta.
 *   • Empty/loading/error states.
 *   • Permission-gated "Add" button (purchases.create).
 */
export function PurchasesListPage(): JSX.Element {
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [cancelFilter, setCancelFilter] = useState<CancelFilter>('active');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      paymentType: paymentFilter === 'all' ? undefined : paymentFilter,
      includeCancelled: cancelFilter === 'all',
    }),
    [page, paymentFilter, cancelFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchases', queryParams],
    queryFn: () => purchasesApi.list(queryParams),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="المشتريات">
      <PageHeader
        title="المشتريات"
        actions={
          <PermissionGate permission="purchases.create">
            <Link to="/purchases/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>عملية شراء</Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as PaymentFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب نوع الدفع"
              data-testid="purchases-payment-filter"
            >
              <option value="all">كل الأنواع</option>
              <option value="CASH">نقد</option>
              <option value="CREDIT">آجل</option>
            </select>
            <select
              value={cancelFilter}
              onChange={(e) => {
                setCancelFilter(e.target.value as CancelFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="إظهار الملغاة"
              data-testid="purchases-cancel-filter"
            >
              <option value="active">إخفاء الملغاة</option>
              <option value="all">إظهار الملغاة</option>
            </select>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="purchases-loading">
            {['p0', 'p1', 'p2', 'p3', 'p4'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل قائمة المشتريات"
            description="حدث خطأ في الشبكة. حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا توجد عمليات شراء بعد"
            description="ابدأ بتسجيل أول عملية شراء (نقد أو آجل) لمتابعة المخزون والمستحقات."
            icon={ShoppingCart}
            action={
              <PermissionGate permission="purchases.create">
                <Link to="/purchases/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>
                    تسجيل عملية شراء
                  </Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="purchases-list">
              {data.items.map((p) => (
                <li key={p.id}>
                  <PurchaseCard purchase={p} />
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between" data-testid="purchases-pagination">
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

export default PurchasesListPage;
