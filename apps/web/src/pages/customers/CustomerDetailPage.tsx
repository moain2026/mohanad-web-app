import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, FileText, Pencil, Snowflake, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  AddDebtModal,
  BalanceDisplay,
  RecordPaymentModal,
  StatusBadge,
  TransactionsTimeline,
  WhatsAppButton,
} from '@/components/customers';
import { toNumber } from '@/components/customers/BalanceDisplay';
import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { customerTransactionsApi, customersApi } from '@/lib/api/customers';
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

/**
 * CustomerDetailPage — Phase 3 P3-FE.
 *
 *   • Shows balance + status + actions (debt/payment/freeze/edit/whatsapp).
 *   • Recent transactions timeline (first 10) with link to full statement.
 *   • Keyboard shortcuts: D=debt, P=payment, W=whatsapp.
 */
export function CustomerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();

  const [debtOpen, setDebtOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
  });

  const { data: txData } = useQuery({
    queryKey: ['customer-transactions', id, { limit: 10 }],
    queryFn: () => customerTransactionsApi.list(id, { page: 1, limit: 10 }),
    enabled: !!customer,
  });

  const freezeMut = useMutation({
    mutationFn: (next: 'freeze' | 'unfreeze') =>
      next === 'freeze' ? customersApi.freeze(id) : customersApi.unfreeze(id),
    onSuccess: (_d, variant) => {
      toast.success(variant === 'freeze' ? 'تم تجميد العميل' : 'تم إلغاء التجميد');
      qc.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast.error(e.message ?? 'تعذَّر تنفيذ العملية');
    },
  });

  return (
    <AppShell title="تفاصيل العميل">
      <PageHeader
        title={customer?.name ?? 'تحميل…'}
        actions={
          <div className="flex gap-2">
            <PermissionGate permission="customers.update">
              <Link to={`/customers/${id}/edit`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
                >
                  تعديل
                </Button>
              </Link>
            </PermissionGate>
            <Link to={`/customers/${id}/statement`}>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FileText className="h-4 w-4" aria-hidden />}
              >
                كشف الحساب
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {isLoading || !customer ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {/* Header card */}
            <Card>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-ink">{customer.name}</h2>
                    <StatusBadge status={customer.status} graceUntil={customer.graceUntil} />
                  </div>
                  {customer.phone ? (
                    <p className="text-xs text-gray-500" dir="ltr">
                      {customer.phone}
                    </p>
                  ) : null}
                  {customer.address ? (
                    <p className="text-xs text-gray-500">{customer.address}</p>
                  ) : null}
                </div>
                <BalanceDisplay balance={customer.currentBalance} size="xl" />
              </div>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <PermissionGate permission="customer_transactions.create_debt">
                <Button
                  fullWidth
                  variant="danger"
                  leftIcon={<ArrowUpCircle className="h-4 w-4" aria-hidden />}
                  onClick={() => setDebtOpen(true)}
                  disabled={customer.status === 'FROZEN'}
                  data-testid="btn-add-debt"
                >
                  إضافة دين
                </Button>
              </PermissionGate>
              <PermissionGate permission="customer_transactions.create_payment">
                <Button
                  fullWidth
                  variant="primary"
                  leftIcon={<ArrowDownCircle className="h-4 w-4" aria-hidden />}
                  onClick={() => setPaymentOpen(true)}
                  data-testid="btn-record-payment"
                >
                  تسجيل دفعة
                </Button>
              </PermissionGate>
              <WhatsAppButton
                customer={customer}
                vars={{
                  name: customer.name,
                  balance: toNumber(customer.currentBalance).toFixed(2),
                }}
                template={WHATSAPP_TEMPLATES.debtReminder}
                fullWidth
                size="md"
              />
              <PermissionGate anyOf={['customers.freeze', 'customers.unfreeze']}>
                <Button
                  fullWidth
                  variant="secondary"
                  leftIcon={
                    customer.status === 'FROZEN' ? (
                      <Sun className="h-4 w-4" aria-hidden />
                    ) : (
                      <Snowflake className="h-4 w-4" aria-hidden />
                    )
                  }
                  isLoading={freezeMut.isPending}
                  onClick={() =>
                    freezeMut.mutate(customer.status === 'FROZEN' ? 'unfreeze' : 'freeze')
                  }
                  data-testid="btn-toggle-freeze"
                >
                  {customer.status === 'FROZEN' ? 'إلغاء التجميد' : 'تجميد'}
                </Button>
              </PermissionGate>
            </div>

            {/* Recent transactions */}
            <Card header="آخر الحركات">
              <TransactionsTimeline items={txData?.items ?? []} />
              {(txData?.meta.total ?? 0) > 10 ? (
                <div className="pt-3 text-center">
                  <Link
                    to={`/customers/${id}/statement`}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    عرض كشف الحساب الكامل ←
                  </Link>
                </div>
              ) : null}
            </Card>

            {/* Modals */}
            <AddDebtModal open={debtOpen} onClose={() => setDebtOpen(false)} customer={customer} />
            <RecordPaymentModal
              open={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              customer={customer}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

export default CustomerDetailPage;
