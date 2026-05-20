import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, Info, Link2, Wallet } from 'lucide-react';
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
import { type ExpenseType, expenseCategoriesApi, expensesApi } from '@/lib/api/expenses';
import { purchasesApi } from '@/lib/api/purchases';
import { suppliersApi } from '@/lib/api/suppliers';

/**
 * NewExpensePage — Phase 5 Frontend.
 *
 * Single create flow that branches on `type`:
 *   • NORMAL              → cat + amount + description.   Affects daily_income.normal_expenses.
 *   • SUPPLIER_PAYMENT    → cat + supplier + amount.      Atomically creates
 *                            SupplierTransaction(PAYMENT) and reduces supplier balance.
 *                            Affects daily_income.supplier_payments.
 *   • CASH_PURCHASE_LINK  → cat + purchase + amount.      Links an existing CASH
 *                            purchase to a category. NO financial effect — daily
 *                            income reads cash_purchases from purchases directly
 *                            (no double-counting).
 *
 * All three rules are LOCKED — they mirror docs/12-agent-memory.md and the
 * server-side superRefine in `createExpenseSchema`.
 */
export function NewExpensePage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const location = useLocation();

  // Allow prefilling type / supplierId / purchaseId via querystring (used from
  // supplier-detail and purchase-detail "Add expense" CTAs).
  const initial = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const t = (p.get('type') as ExpenseType | null) ?? 'NORMAL';
    return {
      type: (['NORMAL', 'SUPPLIER_PAYMENT', 'CASH_PURCHASE_LINK'] as const).includes(t)
        ? t
        : 'NORMAL',
      supplierId: p.get('supplierId') ?? '',
      purchaseId: p.get('purchaseId') ?? '',
    };
  }, [location.search]);

  const [type, setType] = useState<ExpenseType>(initial.type as ExpenseType);
  const [categoryId, setCategoryId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>(initial.supplierId);
  const [purchaseId, setPurchaseId] = useState<string>(initial.purchaseId);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['expense-categories', { all: true }],
    queryFn: () =>
      expenseCategoriesApi.list({ page: 1, limit: 100 } as Parameters<
        typeof expenseCategoriesApi.list
      >[0]),
  });
  const categoryList = categoriesData?.items ?? [];

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    enabled: type === 'SUPPLIER_PAYMENT',
    queryKey: ['suppliers', { all: true, isActive: true }],
    queryFn: () =>
      suppliersApi.list({ page: 1, limit: 100, isActive: true } as Parameters<
        typeof suppliersApi.list
      >[0]),
  });
  const supplierList = suppliersData?.items ?? [];

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    enabled: type === 'CASH_PURCHASE_LINK',
    queryKey: ['purchases', { all: true, paymentType: 'CASH', includeCancelled: false }],
    queryFn: () =>
      purchasesApi.list({ page: 1, limit: 100, paymentType: 'CASH' } as Parameters<
        typeof purchasesApi.list
      >[0]),
  });
  const purchaseList = (purchasesData?.items ?? []).filter((p) => !p.cancelledAt);

  const amountNum = Number(amount || '0');
  const valid =
    !!categoryId &&
    description.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    (type !== 'SUPPLIER_PAYMENT' || !!supplierId) &&
    (type !== 'CASH_PURCHASE_LINK' || !!purchaseId);

  const mutation = useMutation({
    mutationFn: () =>
      expensesApi.create({
        type,
        categoryId,
        amount: amountNum,
        description: description.trim(),
        supplierId: type === 'SUPPLIER_PAYMENT' ? supplierId : undefined,
        purchaseId: type === 'CASH_PURCHASE_LINK' ? purchaseId : undefined,
      } as Parameters<typeof expensesApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم تسجيل المصروف بنجاح');
      history.push(`/expenses/${created.id}`);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'حدث خطأ في تسجيل المصروف');
    },
  });

  const typeEffect: Record<ExpenseType, string> = {
    NORMAL: 'مصروف عادي: يُسجَّل في حسابات اليوم ضمن المصروفات العادية.',
    SUPPLIER_PAYMENT:
      'دفعة مورّد: تُسجَّل ذرّياً + يقلّ رصيد المورّد بقيمة الدفعة. تُسجَّل في اليوم ضمن مدفوعات الموردين.',
    CASH_PURCHASE_LINK:
      'ربط شراء نقدي: لا تأثير مالي إضافي — السجل المالي الأصلي هو الفاتورة نفسها (لتفادي العدّ المُكرَّر).',
  };

  return (
    <AppShell title="مصروف جديد">
      <PageHeader title="مصروف جديد" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card header="نوع المصروف">
          {/* 3-mode picker */}
          <fieldset className="grid grid-cols-1 gap-2 md:grid-cols-3" aria-label="نوع المصروف">
            {(
              [
                {
                  key: 'NORMAL' as const,
                  label: 'عادي',
                  Icon: Wallet,
                  active: 'border-primary-500 bg-primary-50 text-primary-700 font-semibold',
                },
                {
                  key: 'SUPPLIER_PAYMENT' as const,
                  label: 'دفعة مورّد',
                  Icon: Banknote,
                  active: 'border-amber-500 bg-amber-50 text-amber-800 font-semibold',
                },
                {
                  key: 'CASH_PURCHASE_LINK' as const,
                  label: 'ربط شراء نقدي',
                  Icon: Link2,
                  active: 'border-blue-500 bg-blue-50 text-blue-800 font-semibold',
                },
              ] as const
            ).map((opt) => {
              const isOn = type === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setType(opt.key);
                    // Clear conditional pickers when switching.
                    if (opt.key !== 'SUPPLIER_PAYMENT') setSupplierId('');
                    if (opt.key !== 'CASH_PURCHASE_LINK') setPurchaseId('');
                  }}
                  aria-pressed={isOn}
                  data-testid={`new-expense-type-${opt.key.toLowerCase()}`}
                  className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                    isOn
                      ? opt.active
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <opt.Icon className="h-4 w-4" aria-hidden />
                  {opt.label}
                </button>
              );
            })}
          </fieldset>

          <div
            className="mt-3 flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800"
            data-testid="expense-type-effect"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>{typeEffect[type]}</span>
          </div>
        </Card>

        <Card header="البيانات">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="new-expense-form"
          >
            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                الفئة <span className="text-red-600">*</span>
              </label>
              {categoriesLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <select
                  id="expense-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  data-testid="new-expense-category"
                  required
                >
                  <option value="">— اختر الفئة —</option>
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {!categoriesLoading && categoryList.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700" data-testid="no-categories-warning">
                  لا توجد فئات بعد. أنشئ فئة أولاً من شاشة فئات المصروفات.
                </p>
              ) : null}
            </div>

            {type === 'SUPPLIER_PAYMENT' ? (
              <div>
                <label
                  htmlFor="expense-supplier"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  المورّد <span className="text-red-600">*</span>
                </label>
                {suppliersLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <select
                    id="expense-supplier"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    data-testid="new-expense-supplier"
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
            ) : null}

            {type === 'CASH_PURCHASE_LINK' ? (
              <div>
                <label
                  htmlFor="expense-purchase"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  عملية الشراء النقدية <span className="text-red-600">*</span>
                </label>
                {purchasesLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <select
                    id="expense-purchase"
                    value={purchaseId}
                    onChange={(e) => setPurchaseId(e.target.value)}
                    className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    data-testid="new-expense-purchase"
                    required
                  >
                    <option value="">— اختر فاتورة الشراء النقدية —</option>
                    {purchaseList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.supplier?.name ?? 'مورّد محذوف'} — {Number(p.totalAmount).toFixed(2)} ريال
                        — {new Date(p.createdAt).toLocaleDateString('ar-SA')}
                      </option>
                    ))}
                  </select>
                )}
                {!purchasesLoading && purchaseList.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-700">لا توجد فواتير شراء نقدية متاحة.</p>
                ) : null}
              </div>
            ) : null}

            <Input
              label="المبلغ"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="new-expense-amount"
            />

            <Input
              label="الوصف"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر للمصروف"
              data-testid="new-expense-description"
            />

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
                type="submit"
                isLoading={mutation.isPending}
                disabled={!valid}
                data-testid="new-expense-submit"
              >
                تسجيل المصروف
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

export default NewExpensePage;
