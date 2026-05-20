import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, ExternalLink, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';

import { ExpenseTypeBadge } from '@/components/expenses';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { expensesApi } from '@/lib/api/expenses';

/**
 * ExpenseDetailPage — Phase 5 Frontend.
 *
 *   • Read-only view: category, type, amount, description, expense date.
 *   • Shows linked supplier / purchase when applicable.
 *   • Cancel button (gated by `expenses.cancel`). Server reverses:
 *       - SUPPLIER_PAYMENT → reverses SupplierTransaction + supplier balance.
 *       - CASH_PURCHASE_LINK → no financial reversal (no effect to undo).
 *       - NORMAL → no balance touched.
 */
export function ExpenseDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.get(id),
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cancelMut = useMutation({
    mutationFn: () => expensesApi.cancel(id, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('تم إلغاء المصروف');
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      // For supplier payments, invalidate the supplier caches.
      if (expense?.type === 'SUPPLIER_PAYMENT' && expense.referenceId) {
        qc.invalidateQueries({ queryKey: ['supplier'] });
        qc.invalidateQueries({ queryKey: ['supplier-transactions'] });
        qc.invalidateQueries({ queryKey: ['suppliers'] });
      }
      qc.invalidateQueries({ queryKey: ['daily-income'] });
      setCancelOpen(false);
      setReason('');
      setError(null);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'تعذَّر إلغاء المصروف');
    },
  });

  const cancelDescription =
    expense?.type === 'SUPPLIER_PAYMENT'
      ? 'إلغاء دفعة المورّد سيعكس قيد المورّد ذرّياً (يزداد رصيده بقيمة الدفعة).'
      : expense?.type === 'CASH_PURCHASE_LINK'
        ? 'إلغاء ربط الشراء لا يؤثر على فاتورة الشراء الأصلية، فقط يحذف الربط.'
        : 'إلغاء المصروف العادي سيُزيله من إجماليات اليوم.';

  return (
    <AppShell title="تفاصيل المصروف">
      <PageHeader
        title="تفاصيل المصروف"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              onClick={() => history.goBack()}
            >
              رجوع
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer className="h-4 w-4" aria-hidden />}
              onClick={() => window.print()}
              data-testid="btn-print-expense"
            >
              طباعة
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {isLoading || !expense ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <Card>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-ink">
                      {expense.category?.name ?? 'فئة محذوفة'}
                    </h2>
                    <ExpenseTypeBadge type={expense.type} />
                    {expense.cancelledAt ? (
                      <span className="text-xs font-semibold text-red-600">— ملغى</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-700 break-words">{expense.description}</p>
                  <p className="text-xs text-gray-500">
                    تاريخ المصروف: {new Date(expense.expenseDate).toLocaleDateString('ar-SA')}
                  </p>
                  {expense.cancelledAt ? (
                    <p className="text-xs text-red-600">
                      سبب الإلغاء: {expense.cancelReason ?? '—'} ·{' '}
                      {new Date(expense.cancelledAt).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs text-gray-500">المبلغ</span>
                  <span
                    className="text-2xl font-bold tabular-nums text-ink"
                    data-testid="expense-detail-amount"
                  >
                    {formatSupplierBalance(toNumber(expense.amount))}
                  </span>
                </div>
              </div>
            </Card>

            {/* Reference link (supplier or purchase) */}
            {expense.type === 'SUPPLIER_PAYMENT' && expense.referenceId ? (
              <Card>
                <Link
                  to={`/suppliers/${expense.referenceId}`}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                  data-testid="expense-supplier-link"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  عرض حساب المورّد
                </Link>
              </Card>
            ) : null}
            {expense.type === 'CASH_PURCHASE_LINK' && expense.referenceId ? (
              <Card>
                <Link
                  to={`/purchases/${expense.referenceId}`}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                  data-testid="expense-purchase-link"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  عرض فاتورة الشراء المرتبطة
                </Link>
              </Card>
            ) : null}

            {!expense.cancelledAt ? (
              <PermissionGate permission="expenses.cancel">
                <div className="flex justify-end">
                  <Button
                    variant="danger"
                    leftIcon={<Ban className="h-4 w-4" aria-hidden />}
                    onClick={() => setCancelOpen(true)}
                    data-testid="btn-cancel-expense"
                  >
                    إلغاء المصروف
                  </Button>
                </div>
              </PermissionGate>
            ) : null}
          </>
        )}
      </div>

      {expense ? (
        <Modal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="تأكيد إلغاء المصروف"
          description={cancelDescription}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (reason.trim().length >= 1) cancelMut.mutate();
            }}
            className="space-y-3"
            data-testid="cancel-expense-form"
          >
            <Input
              label="سبب الإلغاء"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مرجع المستند / السبب"
              data-testid="cancel-expense-reason"
            />
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
                تراجع
              </Button>
              <Button
                type="submit"
                variant="danger"
                isLoading={cancelMut.isPending}
                disabled={reason.trim().length < 1}
                data-testid="cancel-expense-confirm"
              >
                تأكيد الإلغاء
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  );
}

export default ExpenseDetailPage;
