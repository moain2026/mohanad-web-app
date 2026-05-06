import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type Supplier, supplierTransactionsApi } from '@/lib/api/suppliers';

import { SupplierBalanceDisplay, formatSupplierBalance, toNumber } from './SupplierBalanceDisplay';

/**
 * RecordSupplierPaymentModal — Phase 4 P4-FE.
 *
 *   • Records a payment FROM the store TO the supplier (decreases balance).
 *   • Validates positive amount.
 *   • Live preview: balance after = current − amount.
 *   • Surfaces an "overpay" warning if the new balance turns negative
 *     (the supplier will owe us back).
 *   • Renders the API error message (Arabic) on failure.
 *   • Invalidates ['supplier', id] + ['supplier-transactions', id] on success.
 */
export interface RecordSupplierPaymentModalProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
}

export function RecordSupplierPaymentModal({
  open,
  onClose,
  supplier,
}: RecordSupplierPaymentModalProps): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountNum = toNumber(amount || '0');
  const currentBal = toNumber(supplier.currentBalance);
  const previewBalance = currentBal - amountNum;
  const willOverpay = amountNum > 0 && previewBalance < 0;

  const valid = amountNum > 0 && supplier.isActive;

  const mutation = useMutation({
    mutationFn: () =>
      supplierTransactionsApi.createPayment(supplier.id, {
        amount: amountNum,
        notes: notes || undefined,
      } as Parameters<typeof supplierTransactionsApi.createPayment>[1]),
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح');
      qc.invalidateQueries({ queryKey: ['supplier', supplier.id] });
      qc.invalidateQueries({ queryKey: ['supplier-transactions', supplier.id] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
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
      title="تسجيل دفعة للمورّد"
      description={`المورّد: ${supplier.name}`}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="record-supplier-payment-form"
      >
        <div className="grid grid-cols-2 gap-3">
          <SupplierBalanceDisplay
            balance={supplier.currentBalance}
            label="الرصيد الحالي"
            size="md"
          />
          <SupplierBalanceDisplay balance={previewBalance} label="الرصيد بعد العملية" size="md" />
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
          data-testid="record-supplier-payment-amount"
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
            data-testid="supplier-overpay-warning"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              المبلغ يتجاوز ما نحن مدينون به ({formatSupplierBalance(currentBal)}). الفائض سيُسجَّل
              لصالحنا (المورّد سيدين لنا).
            </span>
          </div>
        ) : null}

        {!supplier.isActive ? (
          <p className="text-xs text-red-600" role="alert">
            المورّد غير نشط. لا يمكن تسجيل دفعة.
          </p>
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
            data-testid="record-supplier-payment-submit"
          >
            تسجيل الدفعة
          </Button>
        </div>
      </form>
    </Modal>
  );
}
