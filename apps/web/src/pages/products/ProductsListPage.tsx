import { useQuery } from '@tanstack/react-query';
import { Package, PlusCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { productsApi } from '@/lib/api/products';
import { formatMoney } from '@grocery/shared';

const PAGE_SIZE = 20;

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

export function ProductsListPage(): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: search || undefined, lowStockOnly, includeArchived }),
    [page, search, lowStockOnly, includeArchived],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
  });

  return (
    <AppShell title="المنتجات">
      <PageHeader
        title="المنتجات"
        actions={
          <PermissionGate permission="products.create">
            <Link to="/products/new">
              <Button leftIcon={<PlusCircle className="h-4 w-4" />}>منتج جديد</Button>
            </Link>
          </PermissionGate>
        }
      />
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
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
                placeholder="ابحث بالاسم أو SKU…"
                className="pe-9"
                data-testid="products-search"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => {
                  setLowStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                data-testid="products-low-stock-filter"
              />
              مخزون منخفض فقط
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => {
                  setIncludeArchived(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              يشمل المؤرشف
            </label>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {['s0', 's1', 's2', 's3'].map((k) => (
              <Skeleton key={k} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل المنتجات"
            description="حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا توجد منتجات بعد"
            description="ابدأ بإضافة منتج لتتبّع المخزون."
            icon={Package}
            action={
              <PermissionGate permission="products.create">
                <Link to="/products/new">
                  <Button leftIcon={<PlusCircle className="h-4 w-4" />}>إضافة منتج</Button>
                </Link>
              </PermissionGate>
            }
          />
        ) : (
          <ul className="space-y-2" data-testid="products-list">
            {data.items.map((p) => {
              const stock = num(p.currentStock);
              const reorder = num(p.reorderLevel);
              const isLow = reorder > 0 && stock <= reorder;
              return (
                <li key={p.id}>
                  <Link to={`/products/${p.id}`} className="block">
                    <Card className="transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                            {!p.isActive ? <Badge variant="danger">مؤرشف</Badge> : null}
                            {isLow ? <Badge variant="warning">مخزون منخفض</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {p.sku ? `SKU: ${p.sku} · ` : ''}
                            {p.category ? `${p.category} · ` : ''}
                            الوحدة: {p.unit}
                          </p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-mono font-semibold text-ink">
                            {stock} {p.unit}
                          </p>
                          <p className="text-xs text-gray-500">
                            سعر البيع: {formatMoney(num(p.sellPrice))}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {data && data.meta.totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </Button>
            <span className="text-xs text-gray-500">
              صفحة {page} من {data.meta.totalPages} — {data.meta.total} منتج
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default ProductsListPage;
