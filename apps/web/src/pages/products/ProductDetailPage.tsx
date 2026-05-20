import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Edit3, Trash2 } from 'lucide-react';
import { Link, useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { productsApi, stockMovementsApi } from '@/lib/api/products';
import { formatMoney } from '@grocery/shared';

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

export function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id),
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', { productId: id, limit: 10 }],
    queryFn: () => stockMovementsApi.list({ productId: id, page: 1, limit: 10 }),
    enabled: Boolean(product),
  });

  const archiveMutation = useMutation({
    mutationFn: () => productsApi.archive(id),
    onSuccess: () => {
      toast.success('تم أرشفة المنتج');
      void qc.invalidateQueries({ queryKey: ['product', id] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(extractApiError(err).message ?? 'فشل الأرشفة'),
  });

  const restoreMutation = useMutation({
    mutationFn: () => productsApi.restore(id),
    onSuccess: () => {
      toast.success('تم استرجاع المنتج');
      void qc.invalidateQueries({ queryKey: ['product', id] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(extractApiError(err).message ?? 'فشل الاسترجاع'),
  });

  if (isLoading) {
    return (
      <AppShell title="منتج">
        <PageHeader title="منتج" />
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell title="منتج">
        <PageHeader title="منتج" />
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <Card>
            <p className="text-sm text-gray-600">المنتج غير موجود.</p>
          </Card>
        </div>
      </AppShell>
    );
  }

  const stock = num(product.currentStock);
  const reorder = num(product.reorderLevel);
  const isLow = reorder > 0 && stock <= reorder;

  return (
    <AppShell title={product.name}>
      <PageHeader
        title={product.name}
        actions={
          <div className="flex gap-2">
            <PermissionGate permission="products.update">
              <Link to={`/products/${product.id}/edit`}>
                <Button variant="secondary" leftIcon={<Edit3 className="h-4 w-4" />}>
                  تعديل
                </Button>
              </Link>
            </PermissionGate>
            <PermissionGate
              anyOf={[
                'stock_movements.create_in',
                'stock_movements.create_out',
                'stock_movements.adjust',
              ]}
            >
              <Link to={`/stock-movements/new?productId=${product.id}`}>
                <Button>حركة مخزون</Button>
              </Link>
            </PermissionGate>
            {product.isActive ? (
              <PermissionGate permission="products.archive">
                <Button
                  variant="ghost"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    if (confirm('أرشفة المنتج؟')) archiveMutation.mutate();
                  }}
                  isLoading={archiveMutation.isPending}
                >
                  أرشفة
                </Button>
              </PermissionGate>
            ) : (
              <PermissionGate permission="products.update">
                <Button
                  variant="secondary"
                  leftIcon={<ArchiveRestore className="h-4 w-4" />}
                  onClick={() => restoreMutation.mutate()}
                  isLoading={restoreMutation.isPending}
                >
                  استرجاع
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            {!product.isActive ? <Badge variant="danger">مؤرشف</Badge> : null}
            {isLow ? <Badge variant="warning">مخزون منخفض</Badge> : null}
            {product.sku ? (
              <Badge variant="primary">SKU: {product.sku}</Badge>
            ) : null}
            {product.category ? <Badge variant="primary">{product.category}</Badge> : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">المخزون الحالي</dt>
              <dd className="font-mono font-semibold text-ink">
                {stock} {product.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">حد إعادة الطلب</dt>
              <dd className="font-mono text-ink">
                {reorder} {product.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">سعر التكلفة</dt>
              <dd className="font-mono text-ink">{formatMoney(num(product.costPrice))}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">سعر البيع</dt>
              <dd className="font-mono text-ink">{formatMoney(num(product.sellPrice))}</dd>
            </div>
          </dl>
        </Card>

        <Card header="آخر حركات المخزون">
          {!movements || movements.items.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد حركات بعد.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {movements.items.map((m) => (
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
                      {m.cancelledAt ? <Badge variant="warning">ملغاة</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(m.createdAt).toLocaleString('ar-SA')} · {m.notes ?? '—'}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-semibold text-ink">
                      {Number(m.quantity) > 0 ? '+' : ''}
                      {num(m.quantity)} {product.unit}
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

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => history.push('/products')}>
            العودة لقائمة المنتجات
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default ProductDetailPage;
