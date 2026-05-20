import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, Info, ListChecks, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  type SaleItemRow,
  SaleItemsTable,
  computeSaleItemsTotal,
  makeBlankSaleRow,
} from '@/components/sales';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { customersApi } from '@/lib/api/customers';
import { type SaleMode, salesApi } from '@/lib/api/sales';
import { useAuthStore } from '@/stores/authStore';

/**
 * NewSalePage — Phase 6 Frontend.
 *
 * Single create flow with three modes (the server picks the path via `body.mode`):
 *
 *   QUICK     → Cash, total-only. No items, no customer. Affects cash_sales.
 *   DETAILED  → Cash. Items optional (must reconcile ±0.01). Affects cash_sales.
 *   CREDIT    → Customer-bound. Atomically:
 *                 1. Sale row
 *                 2. CustomerTransaction(DEBT)
 *                 3. Customer.currentBalance += totalAmount
 *               Affects credit_sales (informational only — not in closing cash).
 *
 * Credit-limit handling (CREDIT only):
 *   • Pre-flight: compute predicted balanceAfter from cached customer data
 *     and show a yellow warning if it exceeds creditLimit.
 *   • Submit is gated until the actor confirms acknowledgement (mirrors
 *     AddDebtModal). The server still re-validates and rejects with
 *     CREDIT_LIMIT_EXCEEDED if the actor lacks
 *     `customer_transactions.approve_over_limit`.
 */
export function NewSalePage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const initial = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const m = (p.get('mode') as SaleMode | null) ?? 'QUICK';
    return {
      mode: (['QUICK', 'DETAILED', 'CREDIT'] as const).includes(m) ? m : 'QUICK',
      customerId: p.get('customerId') ?? '',
    };
  }, [location.search]);

  const [mode, setMode] = useState<SaleMode>(initial.mode as SaleMode);
  const [customerId, setCustomerId] = useState<string>(initial.customerId);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [acknowledgeOverLimit, setAcknowledgeOverLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApproveOverLimit = hasPermission('customer_transactions.approve_over_limit');

  // ─── Customer picker (CREDIT only) ───────────────────────
  const { data: customersData, isLoading: customersLoading } = useQuery({
    enabled: mode === 'CREDIT',
    queryKey: ['customers', { all: true, status: 'ACTIVE' }],
    queryFn: () =>
      customersApi.list({ page: 1, limit: 100 } as Parameters<typeof customersApi.list>[0]),
  });
  const customerList = (customersData?.items ?? []).filter((c) => c.status !== 'FROZEN');
  const selectedCustomer = customerList.find((c) => c.id === customerId);

  // ─── Items totals reconciliation (DETAILED/CREDIT) ───────
  const hasItems = items.length > 0;
  const itemsTotal = useMemo(() => computeSaleItemsTotal(items), [items]);
  useEffect(() => {
    if (hasItems && mode !== 'QUICK') {
      setTotalAmount(itemsTotal.toFixed(2));
    }
  }, [hasItems, itemsTotal, mode]);

  const totalNum = Number(totalAmount || '0');
  const itemsMismatch =
    mode !== 'QUICK' &&
    hasItems &&
    Number.isFinite(totalNum) &&
    Math.abs(totalNum - itemsTotal) > 0.01;

  const itemsHaveBlanks = items.some((it) => !it.name.trim() || !it.quantity || !it.unitPrice);

  // ─── Credit-limit pre-flight ─────────────────────────────
  const balanceBefore = selectedCustomer ? toNumber(selectedCustomer.currentBalance) : 0;
  const balanceAfter = balanceBefore + totalNum;
  const creditLimit =
    selectedCustomer?.creditLimit != null
      ? toNumber(selectedCustomer.creditLimit as string | number)
      : null;
  const willExceedLimit =
    mode === 'CREDIT' &&
    creditLimit !== null &&
    creditLimit > 0 &&
    Number.isFinite(balanceAfter) &&
    balanceAfter > creditLimit;

  const valid =
    Number.isFinite(totalNum) &&
    totalNum > 0 &&
    !itemsMismatch &&
    !itemsHaveBlanks &&
    (mode !== 'CREDIT' || !!customerId) &&
    (mode === 'QUICK' || !hasItems || !itemsHaveBlanks) &&
    // QUICK forbids items entirely
    !(mode === 'QUICK' && hasItems) &&
    // If exceeding limit, require either ACK + permission, or no limit
    (!willExceedLimit || (acknowledgeOverLimit && canApproveOverLimit));

  const mutation = useMutation({
    mutationFn: () =>
      salesApi.create({
        mode,
        customerId: mode === 'CREDIT' ? customerId : undefined,
        totalAmount: totalNum,
        notes: notes.trim() || undefined,
        items:
          mode !== 'QUICK' && hasItems
            ? items.map((it) => ({
                name: it.name.trim(),
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
              }))
            : undefined,
      } as Parameters<typeof salesApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم تسجيل البيع بنجاح');
      history.push(`/sales/${created.id}`);
    },
    onError: (err) => {
      const e = extractApiError(err);
      // Map known codes to friendlier Arabic.
      if (e.code === 'CREDIT_LIMIT_EXCEEDED') {
        setError('تجاوز سقف الدين — يلزم تفعيل صلاحية الموافقة على التجاوز.');
        return;
      }
      if (e.code === 'CUSTOMER_FROZEN') {
        setError('العميل مُجمَّد — لا يمكن البيع آجلاً.');
        return;
      }
      setError(e.message ?? 'حدث خطأ في تسجيل البيع');
    },
  });

  const modeEffect: Record<SaleMode, string> = {
    QUICK: 'بيع سريع: نقدي بإجمالي فقط بدون أصناف وبدون عميل. يدخل في cash_sales.',
    DETAILED: 'بيع مُفصَّل: نقدي مع إمكانية إضافة أصناف. يدخل في cash_sales.',
    CREDIT:
      'بيع آجل: يلتزم به العميل المختار. يُسجَّل ذرّياً + يزداد رصيد العميل بالمبلغ. يدخل في credit_sales (إعلامي).',
  };

  return (
    <AppShell title="بيع جديد">
      <PageHeader title="بيع جديد" />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card header="نوع البيع">
          <fieldset className="grid grid-cols-1 gap-2 md:grid-cols-3" aria-label="نوع البيع">
            {(
              [
                {
                  key: 'QUICK' as const,
                  label: 'سريع',
                  Icon: Zap,
                  active: 'border-primary-500 bg-primary-50 text-primary-700 font-semibold',
                },
                {
                  key: 'DETAILED' as const,
                  label: 'مُفصَّل',
                  Icon: ListChecks,
                  active: 'border-green-500 bg-green-50 text-green-800 font-semibold',
                },
                {
                  key: 'CREDIT' as const,
                  label: 'آجل',
                  Icon: CreditCard,
                  active: 'border-blue-500 bg-blue-50 text-blue-800 font-semibold',
                },
              ] as const
            ).map((opt) => {
              const isOn = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setMode(opt.key);
                    if (opt.key === 'QUICK') {
                      setItems([]);
                      setCustomerId('');
                    }
                    if (opt.key !== 'CREDIT') {
                      setCustomerId('');
                      setAcknowledgeOverLimit(false);
                    }
                  }}
                  aria-pressed={isOn}
                  data-testid={`new-sale-mode-${opt.key.toLowerCase()}`}
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
            data-testid="sale-mode-effect"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>{modeEffect[mode]}</span>
          </div>
        </Card>

        <Card header="بيانات الفاتورة">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="new-sale-form"
          >
            {mode === 'CREDIT' ? (
              <div>
                <label
                  htmlFor="sale-customer"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  العميل <span className="text-red-600">*</span>
                </label>
                {customersLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <select
                    id="sale-customer"
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setAcknowledgeOverLimit(false);
                    }}
                    className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    data-testid="new-sale-customer"
                    required
                  >
                    <option value="">— اختر العميل —</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.creditLimit != null
                          ? ` — سقف ${formatSupplierBalance(toNumber(c.creditLimit))}`
                          : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}

            <Input
              label="إجمالي الفاتورة"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              disabled={mode !== 'QUICK' && hasItems}
              helperText={
                mode !== 'QUICK' && hasItems
                  ? 'يُحتسب تلقائياً من مجموع الأصناف عند وجودها.'
                  : undefined
              }
              data-testid="new-sale-total"
            />

            <Input
              label="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات داخلية"
              data-testid="new-sale-notes"
            />

            {/* Credit-limit warning (CREDIT only) */}
            {mode === 'CREDIT' && selectedCustomer ? (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="text-[11px] text-gray-500">الرصيد الحالي</p>
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {formatSupplierBalance(balanceBefore)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">بعد العملية</p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      willExceedLimit ? 'text-red-600' : 'text-ink'
                    }`}
                  >
                    {formatSupplierBalance(balanceAfter)}
                  </p>
                </div>
              </div>
            ) : null}

            {willExceedLimit ? (
              <div
                className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800"
                data-testid="credit-limit-warning"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                <div className="space-y-1">
                  <p>
                    هذا البيع سيتجاوز سقف الائتمان ({formatSupplierBalance(creditLimit ?? 0)}).
                    الرصيد بعد العملية {formatSupplierBalance(balanceAfter)}.
                  </p>
                  {canApproveOverLimit ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverLimit}
                        onChange={(e) => setAcknowledgeOverLimit(e.target.checked)}
                        data-testid="approve-over-limit"
                      />
                      <span>أوافق على تجاوز السقف</span>
                    </label>
                  ) : (
                    <p className="text-red-700">
                      تحتاج صلاحية «الموافقة على تجاوز السقف» لإتمام هذه العملية.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </form>
        </Card>

        {mode !== 'QUICK' ? (
          <Card header="الأصناف (اختياري)">
            <SaleItemsTable items={items} onChange={setItems} />
            {items.length === 0 ? (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setItems([makeBlankSaleRow()])}
                  data-testid="sale-items-start"
                >
                  + إضافة صنف
                </Button>
              </div>
            ) : null}
            {itemsMismatch ? (
              <p
                className="mt-2 text-xs text-red-600"
                role="alert"
                data-testid="sale-items-mismatch"
              >
                مجموع الأصناف ({itemsTotal.toFixed(2)}) لا يطابق إجمالي الفاتورة (
                {totalNum.toFixed(2)}).
              </p>
            ) : null}
          </Card>
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
            data-testid="new-sale-submit"
          >
            تسجيل البيع
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default NewSalePage;
