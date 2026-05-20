import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Archive, BoxIcon, Package, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { productsApi, stockMovementsApi } from '@/lib/api/products';

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

export function InventoryPage(): JSX.Element {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => productsApi.stockSummary(),
  });

  const { data: recent } = useQuery({
    queryKey: ['stock-movements', { limit: 20 }],
    queryFn: () => stockMovementsApi.list({ page: 1, limit: 20 }),
  });

  return (
    <AppShell title="المخزون">
      <PageHeader
        title="المخزون"
        description="نظرة عامة على المنتجات، التنبيهات، وآخر الحركات."
        actions={
          <div className="flex gap-2">
            <PermissionGate
              anyOf={[
                'stock_movements.create_in',
                'stock_movements.create_out',
                'stock_movements.adjust',
              ]}
            >
              <Link to="/stock-movements/new">
                <Button leftIcon={<PlusCircle className="h-4 w-4" />}>حركة جديدة</Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="products.view">
              <Link to="/products">
                <Button variant="secondary">قائمة المنتجات</Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isLoading ? (
            ['s0', 's1', 's2', 's3'].map((k) => <Skeleton key={k} className="h-24 w-full" />)
          ) : summary ? (
            <>
              <Card>
                <p className="text-xs text-gray-500">إجمالي المنتجات</p>
                <p className="mt-1 text-2xl font-bold text-ink flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary-700" />
                  {summary.total}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500">نشطة</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700 flex items-center gap-2">
                  <BoxIcon className="h-5 w-5" />
                  {summary.active}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500">مؤرشفة</p>
                <p className="mt-1 text-2xl font-bold text-gray-700 flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  {summary.archived}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500">مخزون منخفض</p>
                <p
                  className={`mt-1 text-2xl font-bold flex items-center gap-2 ${
                    summary.lowStockCount > 0 ? 'text-amber-700' : 'text-gray-700'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                  {summary.lowStockCount}
                </p>
              </Card>
            </>
          ) : null}
        </div>

        {/* Low stock items */}
        {summary && summary.lowStockItems.length > 0 ? (
          <Card header="تنبيهات مخزون منخفض">
            <ul className="divide-y divide-gray-100" data-testid="low-stock-list">
              {summary.lowStockItems.map((it) => (
                <li key={it.id}>
                  <Link
                    to={`/products/${it.id}`}
                    className="flex items-center justify-between py-2 text-sm hover:bg-amber-50 px-2 -mx-2 rounded"
                  >
                    <div>
                      <p className="font-medium text-ink">{it.name}</p>
                      <p className="text-xs text-gray-500">
                        المخزون: {it.currentStock} / إعادة الطلب: {it.reorderLevel} {it.unit}
                      </p>
                    </div>
                    <Badge variant="warning">منخفض</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* Recent movements */}
        <Card header={`آخر الحركات (${recent?.items.length ?? 0})`}>
          {!recent || recent.items.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد حركات بعد.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.items.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          m.type === 'IN'
                            ? 'success'
                            : m.type === 'OUT'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {m.type === 'IN' ? 'إدخال' : m.type === 'OUT' ? 'إخراج' : 'تسوية'}
                      </Badge>
                      <span className="font-medium text-ink">{m.product?.name ?? '—'}</span>
                      {m.cancelledAt ? <Badge variant="warning">ملغاة</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(m.createdAt).toLocaleString('ar-SA')}
                      {m.createdBy ? ` · ${m.createdBy.fullName || m.createdBy.username}` : ''}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-semibold text-ink">
                      {num(m.quantity) > 0 ? '+' : ''}
                      {num(m.quantity)} {m.product?.unit ?? ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {num(m.stockBefore)} → {num(m.stockAfter)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default InventoryPage;
