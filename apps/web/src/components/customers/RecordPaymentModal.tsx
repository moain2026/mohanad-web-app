import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type Customer, customerTransactionsApi } from '@/lib/api/customers';

import { BalanceDisplay, formatBalance, toNumber } from './BalanceDisplay';

/**
 * RecordPaymentModal — Phase 3 P3-FE.
 *
 *   • Validates positive amount.
 *   • Live balance preview (subtracts from current balance).
 *   • Surfaces over-payment warning (will go negative → credit).
 *   • Renders the API error message (Arabic) on failure.
 */
export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer;
}

export function RecordPaymentModal({
  open,
  onClose,
  customer,
}: RecordPaymentModalProps): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountNum = toNumber(amount || '0');
  const currentBal = toNumber(customer.currentBalance);
  const previewBalance = currentBal - amountNum;
  const willOverpay = amountNum > 0 && previewBalance < 0;

  const valid = amountNum > 0;

  const mutation = useMutation({
    mutationFn: () =>
      customerTransactionsApi.createPayment(customer.id, {
        amount: amountNum,
        notes: notes || undefined,
      } as Parameters<typeof customerTransactionsApi.createPayment>[1]),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح');
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
      qc.invalidateQueries({ queryKey: ['customer-transactions', customer.id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      setAmount('');
      setNotes('');
      setErrorMsg(null);
      onClose();
    },
    onError: (err) => {
      const e = extractApiError(err);
      setErrorMsg(e.message ?? 'حدث خطأ في تسجيل الدفعة');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setErrorMsg(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل دفعة من العميل"
      description={`العميل: ${customer.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="record-payment-form">
        <div className="grid grid-cols-2 gap-3">
          <BalanceDisplay balance={customer.currentBalance} label="الرصيد الحالي" size="md" />
          <BalanceDisplay balance={previewBalance} label="الرصيد بعد العملية" size="md" />
        </div>

        <Input
          label="المبلغ المدفوع"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          data-testid="record-payment-amount"
        />

        <Input
          label="ملاحظات (اختياري)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="رقم الإيصال / الطريقة"
        />

        {willOverpay ? (
          <div
            className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800"
            data-testid="overpay-warning"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              المبلغ يتجاوز الدين الحالي ({formatBalance(currentBal)}). سيُسجَّل الرصيد المتبقي لصالح
              العميل (دائن).
            </span>
          </div>
        ) : null}

        {errorMsg ? (
          <p className="text-xs text-red-600" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            isLoading={mutation.isPending}
            disabled={!valid}
            data-testid="record-payment-submit"
          >
            تسجيل الدفعة
          </Button>
        </div>
      </form>
    </Modal>
  );
}
