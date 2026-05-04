import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type Supplier, supplierTransactionsApi } from '@/lib/api/suppliers';

import { SupplierBalanceDisplay, toNumber } from './SupplierBalanceDisplay';

/**
 * SupplierAdjustmentModal — Phase 4 P4-FE (owner-only via permission gate).
 *
 *   • Records a SIGNED adjustment (positive = increase debt to supplier,
 *     negative = decrease).
 *   • Reason note is required (min 1 char) — enforced server-side via Zod
 *     and mirrored client-side here.
 *   • Live preview: balance after = current + signed amount.
 *   • Renders the API error message (Arabic) on failure.
 *   • Invalidates ['supplier', id] + ['supplier-transactions', id] on success.
 */
export interface SupplierAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
}

export function SupplierAdjustmentModal({
  open,
  onClose,
  supplier,
}: SupplierAdjustmentModalProps): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountNum = toNumber(amount || '0');
  const currentBal = toNumber(supplier.currentBalance);
  const previewBalance = currentBal + amountNum;

  const reasonValid = notes.trim().length >= 1;
  const amountValid = Number.isFinite(amountNum) && amountNum !== 0;
  const valid = reasonValid && amountValid;

  const mutation = useMutation({
    mutationFn: () =>
      supplierTransactionsApi.createAdjustment(supplier.id, {
        amount: amountNum,
        notes: notes.trim(),
      } as Parameters<typeof supplierTransactionsApi.createAdjustment>[1]),
    onSuccess: () => {
      toast.success('تم تسجيل التسوية بنجاح');
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
      setErrorMsg(e.message ?? 'حدث خطأ في تسجيل التسوية');
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
      title="تسوية رصيد المورّد"
      description={`المورّد: ${supplier.name} — موجب يزيد ما نحن مدينون به، سالب ينقصه.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="supplier-adjustment-form">
        <div className="grid grid-cols-2 gap-3">
          <SupplierBalanceDisplay
            balance={supplier.currentBalance}
            label="الرصيد الحالي"
            size="md"
          />
          <SupplierBalanceDisplay balance={previewBalance} label="الرصيد بعد العملية" size="md" />
        </div>

        <Input
          label="مبلغ التسوية (موجب أو سالب)"
          type="number"
          inputMode="decimal"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="مثال: -50.00"
          data-testid="supplier-adjustment-amount"
        />

        <Input
          label="سبب التسوية"
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مرجع المستند / السبب"
          data-testid="supplier-adjustment-reason"
        />

        {!reasonValid ? (
          <div
            className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800"
            data-testid="supplier-adjustment-reason-warning"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>سبب التسوية مطلوب لإثبات أثرها في سجل التدقيق.</span>
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
            data-testid="supplier-adjustment-submit"
          >
            تسجيل التسوية
          </Button>
        </div>
      </form>
    </Modal>
  );
}
