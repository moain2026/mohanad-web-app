import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlusCircle, Search, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { SupplierCard } from '@/components/suppliers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { suppliersApi } from '@/lib/api/suppliers';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'inactive';
type BalanceFilter = 'all' | 'with' | 'clear';

/**
 * SuppliersListPage — Phase 4 Frontend.
 *
 *   • Debounced search by name/phone.
 *   • Status filter (all / active / inactive).
 *   • Balance filter (all / has-balance / settled).
 *   • Pagination via API meta.
 *   • Empty/loading/error states.
 *   • Permission-gated "Add" button (suppliers.create).
 */
export function SuppliersListPage(): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      hasBalance: balanceFilter === 'all' ? undefined : balanceFilter === 'with',
    }),
    [page, search, statusFilter, balanceFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['suppliers', queryParams],
    queryFn: () => suppliersApi.list(queryParams),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="الموردون">
      <PageHeader
        title="الموردون"
        actions={
          <PermissionGate permission="suppliers.create">
            <Link to="/suppliers/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>مورّد جديد</Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث بالاسم أو الهاتف…"
                aria-label="بحث في الموردين"
                className="pe-9"
                data-testid="suppliers-search"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب الحالة"
              data-testid="suppliers-status-filter"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
            <select
              value={balanceFilter}
              onChange={(e) => {
                setBalanceFilter(e.target.value as BalanceFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب الرصيد"
              data-testid="suppliers-balance-filter"
            >
              <option value="all">كل الأرصدة</option>
              <option value="with">برصيد فقط</option>
              <option value="clear">مسوّى فقط</option>
            </select>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="suppliers-loading">
            {['s0', 's1', 's2', 's3', 's4'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل قائمة الموردين"
            description="حدث خطأ في الشبكة. حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا يوجد موردون بعد"
            description="ابدأ بإضافة أول مورّد لتسجيل المشتريات والمدفوعات."
            icon={Truck}
            action={
              <PermissionGate permission="suppliers.create">
                <Link to="/suppliers/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>
                    إضافة مورّد
                  </Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="suppliers-list">
              {data.items.map((s) => (
                <li key={s.id}>
                  <SupplierCard supplier={s} />
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between" data-testid="suppliers-pagination">
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
                  صفحة {page} من {totalPages} — {data.meta.total} مورّد
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

export default SuppliersListPage;
