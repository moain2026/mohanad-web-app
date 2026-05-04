import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  SupplierBalanceDisplay,
  SupplierStatusBadge,
  SupplierTransactionsTimeline,
} from '@/components/suppliers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { suppliersApi } from '@/lib/api/suppliers';

const PAGE_SIZE = 25;

/**
 * SupplierStatementPage — full ledger of a supplier with pagination + print.
 * Mirrors `CustomerStatementPage`.
 */
export function SupplierStatementPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-statement', id, { page, limit: PAGE_SIZE }],
    queryFn: () => suppliersApi.getStatement(id, { page, limit: PAGE_SIZE }),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="كشف حساب المورّد">
      <PageHeader
        title="كشف حساب المورّد"
        actions={
          <Button
            variant="secondary"
            leftIcon={<Printer className="h-4 w-4" aria-hidden />}
            onClick={() => window.print()}
            data-testid="btn-print-supplier-statement"
          >
            طباعة
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <Card>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-ink">{data.supplier.name}</h2>
                    <SupplierStatusBadge isActive={data.supplier.isActive} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">إجمالي الحركات: {data.meta.total}</p>
                </div>
                <SupplierBalanceDisplay
                  balance={data.supplier.currentBalance}
                  size="lg"
                  label="الرصيد الحالي"
                />
              </div>
            </Card>

            <Card header="الحركات">
              <SupplierTransactionsTimeline items={data.items} />
            </Card>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                >
                  السابق
                </Button>
                <span className="text-xs text-gray-500">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
                >
                  التالي
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default SupplierStatementPage;
