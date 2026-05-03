import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlusCircle, Search, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CustomerCard } from '@/components/customers';
import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { customersApi } from '@/lib/api/customers';

const PAGE_SIZE = 20;

/**
 * CustomersListPage — Phase 3 Frontend.
 *
 *   • Debounced search by name/phone.
 *   • Status filter (all/active/frozen/grace).
 *   • Pagination via API meta.
 *   • Empty/loading/error states.
 *   • Permission-gated "Add" button (customers.create).
 */
export function CustomersListPage(): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'FROZEN' | 'GRACE_PERIOD'>(
    'all',
  );
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
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () => customersApi.list(queryParams),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="العملاء">
      <PageHeader
        title="العملاء"
        actions={
          <PermissionGate permission="customers.create">
            <Link to="/customers/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>عميل جديد</Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {/* Filters */}
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
                aria-label="بحث في العملاء"
                className="pe-9"
                data-testid="customers-search"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(1);
              }}
              className="form-select h-11 rounded-md border border-gray-200 bg-white px-3 text-sm"
              aria-label="تصفية حسب الحالة"
              data-testid="customers-status-filter"
            >
              <option value="all">كل الحالات</option>
              <option value="ACTIVE">نشط</option>
              <option value="FROZEN">مجمَّد</option>
              <option value="GRACE_PERIOD">مهلة سداد</option>
            </select>
          </div>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3" data-testid="customers-loading">
            {['s0', 's1', 's2', 's3', 's4'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل قائمة العملاء"
            description="حدث خطأ في الشبكة. حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا يوجد عملاء بعد"
            description="ابدأ بإضافة أول عميل لمتابعة الديون والمدفوعات."
            icon={UsersIcon}
            action={
              <PermissionGate permission="customers.create">
                <Link to="/customers/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}>
                    إضافة عميل
                  </Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="customers-list">
              {data.items.map((c) => (
                <li key={c.id}>
                  <CustomerCard customer={c} />
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between" data-testid="customers-pagination">
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
                  صفحة {page} من {totalPages} — {data.meta.total} عميل
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

export default CustomersListPage;
