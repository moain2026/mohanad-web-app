import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { productsApi, stockMovementsApi } from '@/lib/api/products';

type MoveType = 'IN' | 'OUT' | 'ADJUST';

export function StockMovementFormPage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();
  const location = useLocation();

  const initialProductId = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return p.get('productId') ?? '';
  }, [location.search]);

  const [productId, setProductId] = useState<string>(initialProductId);
  const [type, setType] = useState<MoveType>('IN');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', { all: true }],
    queryFn: () => productsApi.list({ page: 1, limit: 200 }),
  });
  const products = productsData?.items ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      stockMovementsApi.create({
        productId,
        type,
        quantity: Number(quantity) || 0,
        notes: notes || undefined,
      } as Parameters<typeof stockMovementsApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم تسجيل الحركة');
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product', productId] });
      void qc.invalidateQueries({ queryKey: ['stock-movements'] });
      history.push(`/products/${created.productId}`);
    },
    onError: (err) => setError(extractApiError(err).message ?? 'فشل تسجيل الحركة'),
  });

  const qNum = Number(quantity || '0');
  const valid =
    Boolean(productId) &&
    Number.isFinite(qNum) &&
    (type === 'ADJUST' ? qNum !== 0 : qNum > 0);

  const typeHint: Record<MoveType, string> = {
    IN: 'إدخال للمخزون (مشتريات أو مرتجع بيع). الكمية موجبة.',
    OUT: 'إخراج من المخزون (هالك / تالف). الكمية موجبة، تُخصم من الرصيد.',
    ADJUST: 'تسوية: الكمية إشارة (+/-) وتُضاف للمخزون كما هي.',
  };

  return (
    <AppShell title="حركة مخزون جديدة">
      <PageHeader title="حركة مخزون جديدة" />
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="stock-movement-form"
          >
            <div>
              <label htmlFor="sm-product" className="block text-xs font-semibold text-gray-700 mb-1">
                المنتج *
              </label>
              {productsLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <select
                  id="sm-product"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  data-testid="sm-product"
                  required
                >
                  <option value="">— اختر منتج —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.currentStock} {p.unit})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <fieldset className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'IN' as const, label: 'إدخال', cls: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                  { key: 'OUT' as const, label: 'إخراج', cls: 'border-rose-500 bg-rose-50 text-rose-700' },
                  { key: 'ADJUST' as const, label: 'تسوية', cls: 'border-amber-500 bg-amber-50 text-amber-700' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key)}
                  aria-pressed={type === opt.key}
                  data-testid={`sm-type-${opt.key.toLowerCase()}`}
                  className={`rounded-md border p-3 text-sm transition ${
                    type === opt.key
                      ? `${opt.cls} font-semibold`
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </fieldset>
            <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-800">{typeHint[type]}</p>

            <Input
              label={`الكمية ${type === 'ADJUST' ? '(يمكن أن تكون سالبة)' : '*'}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="sm-quantity"
              required
            />

            <Input
              label="ملاحظات (اختياري)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="sm-notes"
            />

            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => history.goBack()}>
                إلغاء
              </Button>
              <Button
                type="submit"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={mutation.isPending}
                disabled={!valid}
                data-testid="sm-submit"
              >
                تسجيل الحركة
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

export default StockMovementFormPage;
