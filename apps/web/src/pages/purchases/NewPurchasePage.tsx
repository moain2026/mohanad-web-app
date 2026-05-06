import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  type PurchaseItemRow,
  PurchaseItemsTable,
  computeItemsTotal,
  makeBlankRow,
} from '@/components/purchases';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type PurchasePaymentType, purchasesApi } from '@/lib/api/purchases';
import { suppliersApi } from '@/lib/api/suppliers';

/**
 * NewPurchasePage — Phase 4 P4-FE.
 *
 * Single create flow that branches to CASH or CREDIT based on the selected
 * payment type. The accounting effect of the choice is shown to the user up
 * front so the rule is transparent (mirrors the LOCKED rule in
 * docs/12-agent-memory.md):
 *
 *   • CASH   → Purchase row only, NO supplier-balance change.
 *   • CREDIT → Purchase + SupplierTransaction(CREDIT_PURCHASE) atomically,
 *              supplier balance increases by totalAmount.
 *
 * Items are optional. When provided, sum(line totals) MUST equal the typed
 * totalAmount within 0.01; the form blocks submit if they diverge.
 */
export function NewPurchasePage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const location = useLocation();
  const initialSupplierId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('supplierId') ?? '';
  }, [location.search]);

  const [supplierId, setSupplierId] = useState<string>(initialSupplierId);
  const [paymentType, setPaymentType] = useState<PurchasePaymentType>('CASH');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', { all: true, isActive: true }],
    queryFn: () =>
      suppliersApi.list({ page: 1, limit: 100, isActive: true } as Parameters<
        typeof suppliersApi.list
      >[0]),
  });

  const supplierList = suppliersData?.items ?? [];
  const selectedSupplier = supplierList.find((s) => s.id === supplierId);

  // Items grand-total drives the total field automatically when items exist.
  const itemsTotal = useMemo(() => computeItemsTotal(items), [items]);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (hasItems) {
      setTotalAmount(itemsTotal.toFixed(2));
    }
  }, [hasItems, itemsTotal]);

  const totalNum = Number(totalAmount || '0');
  const itemsMismatch =
    hasItems && Number.isFinite(totalNum) && Math.abs(totalNum - itemsTotal) > 0.01;

  const itemsHaveBlanks = items.some((it) => !it.name.trim() || !it.quantity || !it.unitCost);

  const valid =
    !!supplierId && Number.isFinite(totalNum) && totalNum > 0 && !itemsMismatch && !itemsHaveBlanks;

  const mutation = useMutation({
    mutationFn: () =>
      purchasesApi.create({
        supplierId,
        paymentType,
        totalAmount: totalNum,
        notes: notes.trim() || undefined,
        items: hasItems
          ? items.map((it) => ({
              name: it.name.trim(),
              quantity: Number(it.quantity),
              unitCost: Number(it.unitCost),
            }))
          : undefined,
      } as Parameters<typeof purchasesApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم تسجيل عملية الشراء بنجاح');
      history.push(`/purchases/${created.id}`);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'حدث خطأ في تسجيل عملية الشراء');
    },
  });

  return (
    <AppShell title="عملية شراء جديدة">
      <PageHeader title="عملية شراء جديدة" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card header="بيانات الفاتورة">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="new-purchase-form"
          >
            <div>
              <label
                htmlFor="supplier-select"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                المورّد <span className="text-red-600">*</span>
              </label>
              {suppliersLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <select
                  id="supplier-select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  data-testid="new-purchase-supplier"
                  required
                >
                  <option value="">— اختر المورّد —</option>
                  {supplierList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment type toggle */}
            <fieldset className="grid grid-cols-2 gap-2" aria-label="نوع الدفع">
              <button
                type="button"
                onClick={() => setPaymentType('CASH')}
                aria-pressed={paymentType === 'CASH'}
                data-testid="new-purchase-cash"
                className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                  paymentType === 'CASH'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Banknote className="h-4 w-4" aria-hidden />
                نقد
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('CREDIT')}
                aria-pressed={paymentType === 'CREDIT'}
                data-testid="new-purchase-credit"
                className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                  paymentType === 'CREDIT'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                آجل
              </button>
            </fieldset>

            <div
              className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800"
              data-testid="payment-type-effect"
            >
              <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                {paymentType === 'CASH'
                  ? 'نقد: تُسجَّل الفاتورة فقط، رصيد المورّد لا يتغيّر.'
                  : 'آجل: يزداد رصيد المورّد بقيمة الفاتورة (نلتزم بدفعه لاحقاً).'}
              </span>
            </div>

            <Input
              label="إجمالي الفاتورة"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              disabled={hasItems}
              helperText={hasItems ? 'يُحتسب تلقائياً من مجموع الأصناف عند وجودها.' : undefined}
              data-testid="new-purchase-total"
            />

            <Input
              label="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم الفاتورة / ملاحظات داخلية"
            />
          </form>
        </Card>

        <Card header="الأصناف (اختياري)">
          <PurchaseItemsTable items={items} onChange={setItems} />
          {items.length === 0 ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems([makeBlankRow()])}
                data-testid="purchase-items-start"
              >
                + إضافة صنف
              </Button>
            </div>
          ) : null}
          {itemsMismatch ? (
            <p
              className="mt-2 text-xs text-red-600"
              role="alert"
              data-testid="purchase-items-mismatch"
            >
              مجموع الأصناف ({itemsTotal.toFixed(2)}) لا يطابق إجمالي الفاتورة (
              {totalNum.toFixed(2)}).
            </p>
          ) : null}
        </Card>

        {selectedSupplier && paymentType === 'CREDIT' && !selectedSupplier.isActive ? (
          <p className="text-xs text-red-600" role="alert" data-testid="supplier-inactive-warning">
            المورّد غير نشط. لا يمكن تسجيل شراء آجل.
          </p>
        ) : null}

        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={() => history.goBack()}>
            إلغاء
          </Button>
          <Button
            type="button"
            isLoading={mutation.isPending}
            disabled={!valid}
            onClick={() => {
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="new-purchase-submit"
          >
            تسجيل عملية الشراء
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default NewPurchasePage;
