import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LockKeyhole, Unlock } from 'lucide-react';
import { useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dailyIncomeApi } from '@/lib/api/daily-income';

/**
 * DailyIncomeByDatePage — Phase 5 Frontend.
 *
 *   Read-only detail of a specific day (closed or open).
 *   URL param `:date` is in YYYY-MM-DD format.
 */
export function DailyIncomeByDatePage(): JSX.Element {
  const { date } = useParams<{ date: string }>();
  const history = useHistory();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['daily-income', 'by-date', date],
    queryFn: () => dailyIncomeApi.byDate(date),
  });

  return (
    <AppShell title={`يوم ${date}`}>
      <PageHeader
        title={`تفاصيل يوم ${date}`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
            onClick={() => history.goBack()}
          >
            رجوع
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError || !data ? (
          <EmptyState title="لم يُعثر على بيانات لهذا اليوم" />
        ) : (
          <>
            <Card>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      {new Date(data.date).toLocaleDateString('ar-SA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h2>
                    {data.closedAt ? (
                      <Badge
                        variant="neutral"
                        icon={<LockKeyhole className="h-3 w-3" aria-hidden />}
                      >
                        مُقفَل
                      </Badge>
                    ) : (
                      <Badge variant="success" icon={<Unlock className="h-3 w-3" aria-hidden />}>
                        مفتوح
                      </Badge>
                    )}
                  </div>
                  {data.notes ? <p className="text-xs text-gray-600">{data.notes}</p> : null}
                  {data.closedAt ? (
                    <p className="text-xs text-gray-500">
                      أُقفل في: {new Date(data.closedAt).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500">الرصيد المتوقَّع</span>
                  <span
                    className="text-2xl font-bold tabular-nums text-ink"
                    data-testid="daily-detail-closing"
                  >
                    {formatSupplierBalance(toNumber(data.closingCash))}
                  </span>
                </div>
              </div>
            </Card>

            <Card header="تفاصيل الأرقام">
              <div className="space-y-2" data-testid="daily-detail-breakdown">
                <Row label="الرصيد الافتتاحي" value={data.openingCash} positive />
                <Row label="مبيعات نقدية" value={data.cashSales} positive />
                <Row label="دفعات عملاء" value={data.customerPayments} positive />
                <Row label="مبيعات آجلة (إعلامي)" value={data.creditSales} muted />
                <Row label="مشتريات نقدية" value={data.cashPurchases} negative />
                <Row label="مدفوعات موردين" value={data.supplierPayments} negative />
                <Row label="مصروفات عادية" value={data.normalExpenses} negative />
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <Row label="رصيد الصندوق المتوقَّع" value={data.closingCash} bold />
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

interface RowProps {
  label: string;
  value: string | number;
  positive?: boolean;
  negative?: boolean;
  muted?: boolean;
  bold?: boolean;
}
function Row({ label, value, positive, negative, muted, bold }: RowProps): JSX.Element {
  const color = positive
    ? 'text-green-700'
    : negative
      ? 'text-red-700'
      : muted
        ? 'text-gray-500'
        : 'text-ink';
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? 'font-semibold text-ink' : 'text-gray-600'}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? 'text-lg font-bold text-ink' : `text-sm font-bold ${color}`}`}
      >
        {negative ? '−' : ''}
        {formatSupplierBalance(toNumber(value))}
      </span>
    </div>
  );
}

export default DailyIncomeByDatePage;
