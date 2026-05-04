import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, FileText, Pencil, ShoppingCart, Sliders } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import {
  RecordSupplierPaymentModal,
  SupplierAdjustmentModal,
  SupplierBalanceDisplay,
  SupplierStatusBadge,
  SupplierTransactionsTimeline,
} from '@/components/suppliers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { supplierTransactionsApi, suppliersApi } from '@/lib/api/suppliers';

/**
 * SupplierDetailPage — Phase 4 Frontend.
 *
 *   • Shows balance + status + actions (payment / adjustment / new credit
 *     purchase / edit / statement).
 *   • Recent transactions timeline (first 10) with link to full statement.
 *   • Mirrors `CustomerDetailPage` patterns and toast/invalidation rules.
 */
export function SupplierDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersApi.get(id),
  });

  const { data: txData } = useQuery({
    queryKey: ['supplier-transactions', id, { limit: 10 }],
    queryFn: () => supplierTransactionsApi.list(id, { page: 1, limit: 10 }),
    enabled: !!supplier,
  });

  return (
    <AppShell title="تفاصيل المورّد">
      <PageHeader
        title={supplier?.name ?? 'تحميل…'}
        actions={
          <div className="flex gap-2">
            <PermissionGate permission="suppliers.update">
              <Link to={`/suppliers/${id}/edit`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
                >
                  تعديل
                </Button>
              </Link>
            </PermissionGate>
            <Link to={`/suppliers/${id}/statement`}>
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
        {isLoading || !supplier ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {/* Header card */}
            <Card>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-ink">{supplier.name}</h2>
                    <SupplierStatusBadge isActive={supplier.isActive} />
                  </div>
                  {supplier.phone ? (
                    <p className="text-xs text-gray-500" dir="ltr">
                      {supplier.phone}
                    </p>
                  ) : null}
                  {supplier.address ? (
                    <p className="text-xs text-gray-500">{supplier.address}</p>
                  ) : null}
                </div>
                <SupplierBalanceDisplay balance={supplier.currentBalance} size="xl" />
              </div>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <PermissionGate permission="supplier_transactions.create_payment">
                <Button
                  fullWidth
                  variant="primary"
                  leftIcon={<ArrowDownCircle className="h-4 w-4" aria-hidden />}
                  onClick={() => setPaymentOpen(true)}
                  disabled={!supplier.isActive}
                  data-testid="btn-supplier-payment"
                >
                  تسجيل دفعة
                </Button>
              </PermissionGate>
              <PermissionGate permission="purchases.create">
                <Link to={`/purchases/new?supplierId=${supplier.id}`}>
                  <Button
                    fullWidth
                    variant="secondary"
                    leftIcon={<ShoppingCart className="h-4 w-4" aria-hidden />}
                    data-testid="btn-supplier-new-purchase"
                  >
                    عملية شراء جديدة
                  </Button>
                </Link>
              </PermissionGate>
              <PermissionGate permission="supplier_transactions.create_adjustment">
                <Button
                  fullWidth
                  variant="secondary"
                  leftIcon={<Sliders className="h-4 w-4" aria-hidden />}
                  onClick={() => setAdjustOpen(true)}
                  data-testid="btn-supplier-adjustment"
                >
                  تسوية
                </Button>
              </PermissionGate>
              <Link to={`/suppliers/${id}/statement`}>
                <Button
                  fullWidth
                  variant="ghost"
                  leftIcon={<FileText className="h-4 w-4" aria-hidden />}
                >
                  كشف الحساب
                </Button>
              </Link>
            </div>

            {/* Recent transactions */}
            <Card header="آخر الحركات">
              <SupplierTransactionsTimeline items={txData?.items ?? []} />
              {(txData?.meta.total ?? 0) > 10 ? (
                <div className="pt-3 text-center">
                  <Link
                    to={`/suppliers/${id}/statement`}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    عرض كشف الحساب الكامل ←
                  </Link>
                </div>
              ) : null}
            </Card>

            {/* Modals */}
            <RecordSupplierPaymentModal
              open={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              supplier={supplier}
            />
            <SupplierAdjustmentModal
              open={adjustOpen}
              onClose={() => setAdjustOpen(false)}
              supplier={supplier}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

export default SupplierDetailPage;
