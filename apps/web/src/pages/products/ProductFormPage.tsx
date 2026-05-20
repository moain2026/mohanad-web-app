import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { productsApi } from '@/lib/api/products';

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'carton'] as const;
const UNIT_LABEL: Record<(typeof UNITS)[number], string> = {
  piece: 'قطعة',
  kg: 'كجم',
  g: 'جم',
  l: 'لتر',
  ml: 'مل',
  pack: 'باكيت',
  box: 'صندوق',
  carton: 'كرتون',
};

type FormState = {
  sku: string;
  name: string;
  unit: (typeof UNITS)[number];
  category: string;
  reorderLevel: string;
  costPrice: string;
  sellPrice: string;
  openingStock: string;
};

function emptyForm(): FormState {
  return {
    sku: '',
    name: '',
    unit: 'piece',
    category: '',
    reorderLevel: '0',
    costPrice: '0',
    sellPrice: '0',
    openingStock: '0',
  };
}

/**
 * ProductFormPage — handles both create (/products/new) and edit (/products/:id/edit).
 */
export function ProductFormPage(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id ?? ''),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        sku: existing.sku ?? '',
        name: existing.name,
        unit: (existing.unit as (typeof UNITS)[number]) ?? 'piece',
        category: existing.category ?? '',
        reorderLevel: String(existing.reorderLevel),
        costPrice: String(existing.costPrice),
        sellPrice: String(existing.sellPrice),
        openingStock: String(existing.currentStock),
      });
    }
  }, [existing]);

  const createMutation = useMutation({
    mutationFn: () =>
      productsApi.create({
        sku: form.sku || undefined,
        name: form.name,
        unit: form.unit,
        category: form.category || undefined,
        reorderLevel: Number(form.reorderLevel) || 0,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        openingStock: Number(form.openingStock) || 0,
      } as Parameters<typeof productsApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم إنشاء المنتج');
      void qc.invalidateQueries({ queryKey: ['products'] });
      history.push(`/products/${created.id}`);
    },
    onError: (err) => setError(extractApiError(err).message ?? 'فشل إنشاء المنتج'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      productsApi.update(id ?? '', {
        sku: form.sku || undefined,
        name: form.name,
        unit: form.unit,
        category: form.category || undefined,
        reorderLevel: Number(form.reorderLevel) || 0,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
      } as Parameters<typeof productsApi.update>[1]),
    onSuccess: () => {
      toast.success('تم تحديث المنتج');
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product', id] });
      history.push(`/products/${id}`);
    },
    onError: (err) => setError(extractApiError(err).message ?? 'فشل تحديث المنتج'),
  });

  const valid = form.name.trim().length > 0;
  const title = isEdit ? 'تعديل منتج' : 'منتج جديد';

  if (isEdit && loadingExisting) {
    return (
      <AppShell title={title}>
        <PageHeader title={title} />
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={title}>
      <PageHeader title={title} />
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!valid) return;
              if (isEdit) updateMutation.mutate();
              else createMutation.mutate();
            }}
            data-testid="product-form"
          >
            <Input
              label="اسم المنتج *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              data-testid="product-name"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="SKU (اختياري)"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                data-testid="product-sku"
              />
              <Input
                label="الفئة (اختياري)"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                data-testid="product-category"
              />
            </div>
            <div>
              <label htmlFor="product-unit" className="block text-xs font-semibold text-gray-700 mb-1">
                الوحدة *
              </label>
              <select
                id="product-unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value as (typeof UNITS)[number] })}
                className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                data-testid="product-unit"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]} ({u})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="سعر التكلفة"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                data-testid="product-cost"
              />
              <Input
                label="سعر البيع"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                data-testid="product-sell"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="حد إعادة الطلب"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                data-testid="product-reorder"
              />
              {!isEdit ? (
                <Input
                  label="المخزون الافتتاحي"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.openingStock}
                  onChange={(e) => setForm({ ...form, openingStock: e.target.value })}
                  data-testid="product-opening"
                />
              ) : null}
            </div>

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
                isLoading={createMutation.isPending || updateMutation.isPending}
                disabled={!valid}
                data-testid="product-submit"
              >
                {isEdit ? 'حفظ التغييرات' : 'إنشاء المنتج'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

export default ProductFormPage;
