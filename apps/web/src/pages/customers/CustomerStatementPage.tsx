import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { BalanceDisplay, StatusBadge, TransactionsTimeline } from '@/components/customers';
import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { customersApi } from '@/lib/api/customers';

const PAGE_SIZE = 25;

/**
 * CustomerStatementPage — full ledger of a customer with pagination + print.
 */
export function CustomerStatementPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-statement', id, { page, limit: PAGE_SIZE }],
    queryFn: () => customersApi.getStatement(id, { page, limit: PAGE_SIZE }),
  });

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <AppShell title="كشف الحساب">
      <PageHeader
        title="كشف حساب العميل"
        actions={
          <Button
            variant="secondary"
            leftIcon={<Printer className="h-4 w-4" aria-hidden />}
            onClick={() => window.print()}
            data-testid="btn-print-statement"
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
                    <h2 className="text-base font-semibold text-ink">{data.customer.name}</h2>
                    <StatusBadge status={data.customer.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">إجمالي الحركات: {data.meta.total}</p>
                </div>
                <BalanceDisplay
                  balance={data.customer.currentBalance}
                  size="lg"
                  label="الرصيد الحالي"
                />
              </div>
            </Card>

            <Card header="الحركات">
              <TransactionsTimeline items={data.items} />
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

export default CustomerStatementPage;
