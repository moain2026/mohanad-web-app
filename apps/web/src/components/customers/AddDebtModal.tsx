import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type Customer, customerTransactionsApi } from '@/lib/api/customers';

import { BalanceDisplay, formatBalance, toNumber } from './BalanceDisplay';

/**
 * AddDebtModal — Phase 3 P3-FE.
 *
 *   • Validates positive amount.
 *   • Live balance preview.
 *   • Surfaces credit-limit warning before sending.
 *   • Renders the API error message (Arabic) on failure.
 *   • Invalidates ['customer', id] + ['customer-transactions', id] on success.
 */
export interface AddDebtModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer;
}

export function AddDebtModal({ open, onClose, customer }: AddDebtModalProps): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [approveOverLimit, setApproveOverLimit] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountNum = toNumber(amount || '0');
  const currentBal = toNumber(customer.currentBalance);
  const previewBalance = currentBal + amountNum;
  const creditLimit =
    customer.creditLimit != null ? toNumber(customer.creditLimit as string | number) : null;
  const willExceedLimit = creditLimit !== null && creditLimit > 0 && previewBalance > creditLimit;

  const isFrozen = customer.status === 'FROZEN';

  const valid = amountNum > 0 && !isFrozen;

  const mutation = useMutation({
    mutationFn: () =>
      customerTransactionsApi.createDebt(customer.id, {
        amount: amountNum,
        notes: notes || undefined,
        approveOverLimit: willExceedLimit ? approveOverLimit : undefined,
      } as Parameters<typeof customerTransactionsApi.createDebt>[1]),
    onSuccess: () => {
      toast.success('تم تسجيل الدين بنجاح');
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
      qc.invalidateQueries({ queryKey: ['customer-transactions', customer.id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      setAmount('');
      setNotes('');
      setApproveOverLimit(false);
      setErrorMsg(null);
      onClose();
    },
    onError: (err) => {
      const e = extractApiError(err);
      setErrorMsg(e.message ?? 'حدث خطأ في تسجيل الدين');
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
      title="إضافة دين جديد"
      description={`العميل: ${customer.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-debt-form">
        <div className="grid grid-cols-2 gap-3">
          <BalanceDisplay balance={customer.currentBalance} label="الرصيد الحالي" size="md" />
          <BalanceDisplay balance={previewBalance} label="الرصيد بعد العملية" size="md" />
        </div>

        <Input
          label="المبلغ"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          data-testid="add-debt-amount"
        />

        <Input
          label="ملاحظات (اختياري)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="سبب الدين / تفاصيل"
        />

        {isFrozen ? (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>هذا العميل مجمَّد ولا يمكن إضافة دين عليه. قم بإلغاء التجميد أولاً.</span>
          </div>
        ) : null}

        {willExceedLimit && !isFrozen ? (
          <div
            className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800"
            data-testid="credit-limit-warning"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p>
                هذا الدين سيتجاوز سقف الائتمان ({formatBalance(creditLimit ?? 0)}). الرصيد بعد
                العملية سيكون {formatBalance(previewBalance)}.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveOverLimit}
                  onChange={(e) => setApproveOverLimit(e.target.checked)}
                  data-testid="approve-over-limit"
                />
                <span>أوافق على تجاوز السقف</span>
              </label>
            </div>
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
            disabled={!valid || (willExceedLimit && !approveOverLimit)}
            data-testid="add-debt-submit"
          >
            تسجيل الدين
          </Button>
        </div>
      </form>
    </Modal>
  );
}
