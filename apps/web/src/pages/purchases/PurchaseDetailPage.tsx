import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PurchaseItemsTable, PurchasePaymentBadge } from '@/components/purchases';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { purchasesApi } from '@/lib/api/purchases';

/**
 * PurchaseDetailPage — Phase 4 P4-FE.
 *
 *   • Read-only view of a purchase with items + supplier + meta.
 *   • Cancel button (gated by `purchases.cancel`); cancellation atomically
 *     reverses the supplier balance for CREDIT purchases (handled server-side).
 *   • Print button.
 */
export function PurchaseDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => purchasesApi.get(id),
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cancelMut = useMutation({
    mutationFn: () => purchasesApi.cancel(id, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('تم إلغاء عملية الشراء');
      qc.invalidateQueries({ queryKey: ['purchase', id] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      // CREDIT cancellation reversed the supplier balance — invalidate caches.
      if (purchase?.paymentType === 'CREDIT' && purchase.supplierId) {
        qc.invalidateQueries({ queryKey: ['supplier', purchase.supplierId] });
        qc.invalidateQueries({ queryKey: ['supplier-transactions', purchase.supplierId] });
        qc.invalidateQueries({ queryKey: ['suppliers'] });
      }
      setCancelOpen(false);
      setReason('');
      setError(null);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'تعذَّر إلغاء عملية الشراء');
    },
  });

  return (
    <AppShell title="تفاصيل عملية الشراء">
      <PageHeader
        title="تفاصيل عملية الشراء"
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
              data-testid="btn-print-purchase"
            >
              طباعة
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {isLoading || !purchase ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <Card>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-ink">
                      {purchase.supplier?.name ?? 'مورّد محذوف'}
                    </h2>
                    <PurchasePaymentBadge paymentType={purchase.paymentType} />
                    {purchase.cancelledAt ? (
                      <span className="text-xs font-semibold text-red-600">— ملغاة</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">
                    التاريخ: {new Date(purchase.createdAt).toLocaleString('ar-SA')}
                  </p>
                  {purchase.notes ? (
                    <p className="text-xs text-gray-700 break-words">{purchase.notes}</p>
                  ) : null}
                  {purchase.cancelledAt ? (
                    <p className="text-xs text-red-600">
                      سبب الإلغاء: {purchase.cancelReason ?? '—'} ·{' '}
                      {new Date(purchase.cancelledAt).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs text-gray-500">إجمالي الفاتورة</span>
                  <span
                    className="text-2xl font-bold tabular-nums text-ink"
                    data-testid="purchase-detail-total"
                  >
                    {formatSupplierBalance(toNumber(purchase.totalAmount))}
                  </span>
                </div>
              </div>
            </Card>

            <Card header="الأصناف">
              {purchase.items && purchase.items.length > 0 ? (
                <PurchaseItemsTable
                  readOnly
                  items={purchase.items.map((it) => ({
                    id: it.id,
                    name: it.name,
                    quantity: String(it.quantity),
                    unitCost: String(it.unitCost),
                  }))}
                  onChange={() => {}}
                />
              ) : (
                <p className="text-sm text-gray-500" data-testid="purchase-detail-no-items">
                  لا توجد أصناف — مسجَّلة كإجمالي فقط.
                </p>
              )}
            </Card>

            {!purchase.cancelledAt ? (
              <PermissionGate permission="purchases.cancel">
                <div className="flex justify-end">
                  <Button
                    variant="danger"
                    leftIcon={<Ban className="h-4 w-4" aria-hidden />}
                    onClick={() => setCancelOpen(true)}
                    data-testid="btn-cancel-purchase"
                  >
                    إلغاء عملية الشراء
                  </Button>
                </div>
              </PermissionGate>
            ) : null}

            {purchase.supplier ? (
              <Link
                to={`/suppliers/${purchase.supplier.id}`}
                className="block text-sm text-primary-600 hover:underline"
              >
                ← عرض حساب المورّد
              </Link>
            ) : null}
          </>
        )}
      </div>

      {/* Cancel modal */}
      {purchase ? (
        <Modal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="تأكيد إلغاء عملية الشراء"
          description={
            purchase.paymentType === 'CREDIT'
              ? 'إلغاء عملية الشراء الآجلة سيقلّص رصيد المورّد بقيمة الفاتورة ذرّياً.'
              : 'إلغاء عملية الشراء النقدية لا يؤثر على رصيد المورّد.'
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (reason.trim().length >= 1) cancelMut.mutate();
            }}
            className="space-y-3"
            data-testid="cancel-purchase-form"
          >
            <Input
              label="سبب الإلغاء"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مرجع المستند / السبب"
              data-testid="cancel-purchase-reason"
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
                data-testid="cancel-purchase-confirm"
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

export default PurchaseDetailPage;
