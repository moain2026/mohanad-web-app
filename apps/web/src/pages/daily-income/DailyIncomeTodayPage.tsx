import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  CalendarClock,
  LockKeyhole,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type DailyIncome, dailyIncomeApi } from '@/lib/api/daily-income';

/**
 * DailyIncomeTodayPage — Phase 5 Frontend.
 *
 *  Live snapshot of today's cash flow:
 *
 *    closingCash =
 *        openingCash
 *      + cashSales
 *      + customerPayments
 *      − cashPurchases       (read from purchases — NOT expenses, no double-count)
 *      − supplierPayments
 *      − normalExpenses
 *
 *  Actions:
 *    • Open day  → requires opening cash count (gated by `daily_income.open`).
 *    • Recompute → force aggregation refresh (gated by `daily_income.recompute`).
 *    • Close day → freezes today (gated by `daily_income.close`).
 */
export function DailyIncomeTodayPage(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<DailyIncome | null>({
    queryKey: ['daily-income', 'today'],
    queryFn: async () => {
      try {
        return await dailyIncomeApi.today();
      } catch (err) {
        // 404 = day not opened yet — treat as null.
        const e = extractApiError(err);
        if (e.statusCode === 404) return null;
        throw err;
      }
    },
  });

  const day = data ?? null;
  const isClosed = !!day?.closedAt;

  // ─── Open modal ─────────────────────────────────────────
  const [openOpen, setOpenOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [openError, setOpenError] = useState<string | null>(null);

  const openMut = useMutation({
    mutationFn: () =>
      dailyIncomeApi.open({
        openingCash: Number(openingCash || '0'),
        notes: openNotes.trim() || undefined,
      } as Parameters<typeof dailyIncomeApi.open>[0]),
    onSuccess: () => {
      toast.success('تم فتح اليوم');
      qc.invalidateQueries({ queryKey: ['daily-income'] });
      setOpenOpen(false);
      setOpeningCash('');
      setOpenNotes('');
      setOpenError(null);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setOpenError(e.message ?? 'تعذَّر فتح اليوم');
    },
  });

  // ─── Close modal ────────────────────────────────────────
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  const closeMut = useMutation({
    mutationFn: () =>
      dailyIncomeApi.close({ notes: closeNotes.trim() || undefined } as Parameters<
        typeof dailyIncomeApi.close
      >[0]),
    onSuccess: () => {
      toast.success('تم إقفال اليوم');
      qc.invalidateQueries({ queryKey: ['daily-income'] });
      setCloseOpen(false);
      setCloseNotes('');
      setCloseError(null);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setCloseError(e.message ?? 'تعذَّر إقفال اليوم');
    },
  });

  // ─── Recompute ──────────────────────────────────────────
  const recomputeMut = useMutation({
    mutationFn: () =>
      dailyIncomeApi.recompute({ date: new Date() } as Parameters<
        typeof dailyIncomeApi.recompute
      >[0]),
    onSuccess: () => {
      toast.success('تم إعادة احتساب اليوم');
      qc.invalidateQueries({ queryKey: ['daily-income'] });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast.error(e.message ?? 'تعذَّر إعادة الاحتساب');
    },
  });

  return (
    <AppShell title="إيرادات اليوم">
      <PageHeader
        title="إيرادات اليوم"
        actions={
          <div className="flex gap-2">
            {day && !isClosed ? (
              <PermissionGate permission="daily_income.recompute">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Calculator className="h-4 w-4" aria-hidden />}
                  onClick={() => recomputeMut.mutate()}
                  isLoading={recomputeMut.isPending}
                  data-testid="btn-recompute-day"
                >
                  إعادة احتساب
                </Button>
              </PermissionGate>
            ) : null}
          </div>
        }
      />

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        {isLoading ? (
          <Skeleton className="h-48 w-full" data-testid="daily-today-loading" />
        ) : isError ? (
          <Card>
            <p className="text-sm text-red-600">تعذَّر تحميل بيانات اليوم.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()} className="mt-2">
              إعادة المحاولة
            </Button>
          </Card>
        ) : !day ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CalendarClock className="h-8 w-8 text-gray-400" aria-hidden />
              <h3 className="text-base font-semibold text-ink">لم يُفتح يوم العمل بعد</h3>
              <p className="text-xs text-gray-500">
                ابدأ بفتح اليوم بتسجيل رصيد الصندوق الافتتاحي.
              </p>
              <PermissionGate permission="daily_income.open">
                <Button
                  leftIcon={<Unlock className="h-4 w-4" aria-hidden />}
                  onClick={() => setOpenOpen(true)}
                  data-testid="btn-open-day"
                >
                  فتح اليوم
                </Button>
              </PermissionGate>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      {new Date(day.date).toLocaleDateString('ar-SA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h2>
                    {isClosed ? (
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
                  {day.notes ? <p className="text-xs text-gray-600">{day.notes}</p> : null}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500">رصيد الصندوق المتوقَّع</span>
                  <span
                    className="text-3xl font-bold tabular-nums text-ink"
                    data-testid="daily-today-closing"
                  >
                    {formatSupplierBalance(toNumber(day.closingCash))}
                  </span>
                </div>
              </div>
            </Card>

            {/* Aggregates grid */}
            <Card header="تفاصيل اليوم">
              <div
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
                data-testid="daily-today-breakdown"
              >
                <Row
                  label="الرصيد الافتتاحي"
                  value={day.openingCash}
                  testId="row-opening"
                  positive
                />
                <Row label="مبيعات نقدية" value={day.cashSales} testId="row-cash-sales" positive />
                <Row
                  label="دفعات عملاء"
                  value={day.customerPayments}
                  testId="row-customer-payments"
                  positive
                />
                <Row
                  label="مبيعات آجلة (إعلامي)"
                  value={day.creditSales}
                  testId="row-credit-sales"
                  muted
                />
                <Row
                  label="مشتريات نقدية"
                  value={day.cashPurchases}
                  testId="row-cash-purchases"
                  negative
                />
                <Row
                  label="مدفوعات موردين"
                  value={day.supplierPayments}
                  testId="row-supplier-payments"
                  negative
                />
                <Row
                  label="مصروفات عادية"
                  value={day.normalExpenses}
                  testId="row-normal-expenses"
                  negative
                />
              </div>
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                * مبيعات آجلة تُسجَّل للمتابعة فقط — لا تدخل في رصيد الصندوق المتوقَّع.
              </div>
            </Card>

            {!isClosed ? (
              <div className="flex justify-end">
                <PermissionGate permission="daily_income.close">
                  <Button
                    variant="danger"
                    leftIcon={<LockKeyhole className="h-4 w-4" aria-hidden />}
                    onClick={() => setCloseOpen(true)}
                    data-testid="btn-close-day"
                  >
                    إقفال اليوم
                  </Button>
                </PermissionGate>
              </div>
            ) : (
              <Card>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <LockKeyhole className="h-4 w-4" aria-hidden />
                  تم إقفال هذا اليوم في{' '}
                  {day.closedAt ? new Date(day.closedAt).toLocaleString('ar-SA') : '—'} — لا تعديلات
                  بعد الآن.
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Open day modal */}
      <Modal
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        title="فتح يوم جديد"
        description="ابدأ يوم العمل بتسجيل النقد الموجود في الصندوق."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setOpenError(null);
            if (Number(openingCash) >= 0) openMut.mutate();
          }}
          data-testid="open-day-form"
        >
          <Input
            label="الرصيد الافتتاحي"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            leftIcon={<ArrowUpCircle className="h-4 w-4" aria-hidden />}
            data-testid="open-day-cash"
          />
          <Input
            label="ملاحظات (اختياري)"
            value={openNotes}
            onChange={(e) => setOpenNotes(e.target.value)}
          />
          {openError ? (
            <p className="text-xs text-red-600" role="alert">
              {openError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenOpen(false)}>
              تراجع
            </Button>
            <Button
              type="submit"
              isLoading={openMut.isPending}
              disabled={openingCash === '' || Number(openingCash) < 0}
              data-testid="open-day-confirm"
            >
              فتح اليوم
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close day modal */}
      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="إقفال اليوم"
        description="بعد الإقفال يُصبح اليوم غير قابل للتعديل. تأكَّد من تطابق العدّ الفعلي مع الرصيد المتوقَّع."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setCloseError(null);
            closeMut.mutate();
          }}
          data-testid="close-day-form"
        >
          <Input
            label="ملاحظات الإقفال (اختياري)"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            leftIcon={<ArrowDownCircle className="h-4 w-4" aria-hidden />}
          />
          {closeError ? (
            <p className="text-xs text-red-600" role="alert">
              {closeError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCloseOpen(false)}>
              تراجع
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={closeMut.isPending}
              data-testid="close-day-confirm"
            >
              تأكيد الإقفال
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

interface RowProps {
  label: string;
  value: string | number;
  testId: string;
  positive?: boolean;
  negative?: boolean;
  muted?: boolean;
}
function Row({ label, value, testId, positive, negative, muted }: RowProps): JSX.Element {
  const color = positive
    ? 'text-green-700'
    : negative
      ? 'text-red-700'
      : muted
        ? 'text-gray-500'
        : 'text-ink';
  return (
    <div
      className="flex items-center justify-between rounded-md border border-gray-100 bg-white p-3"
      data-testid={testId}
    >
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>
        {negative ? '−' : ''}
        {formatSupplierBalance(toNumber(value))}
      </span>
    </div>
  );
}

export default DailyIncomeTodayPage;
