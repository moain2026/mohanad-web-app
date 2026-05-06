import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { suppliersApi } from '@/lib/api/suppliers';

/**
 * NewSupplierPage — create a new supplier (with optional opening balance).
 * Mirrors `NewCustomerPage` but with supplier-oriented copy.
 */
export function NewSupplierPage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      suppliersApi.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
        whatsappPhone: whatsappPhone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        openingBalance: openingBalance ? Number(openingBalance) : 0,
      } as Parameters<typeof suppliersApi.create>[0]),
    onSuccess: (created) => {
      toast.success('تم إنشاء المورّد بنجاح');
      history.push(`/suppliers/${created.id}`);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'حدث خطأ في إنشاء المورّد');
    },
  });

  const valid = name.trim().length >= 2;

  return (
    <AppShell title="مورّد جديد">
      <PageHeader title="مورّد جديد" />
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) mutation.mutate();
            }}
            data-testid="new-supplier-form"
          >
            <Input
              label="الاسم"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المورّد الكامل"
              data-testid="new-supplier-name"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="الهاتف"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                inputMode="tel"
                dir="ltr"
              />
              <Input
                label="هاتف واتساب (اختياري)"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                inputMode="tel"
                dir="ltr"
                helperText="يستخدم لإرسال إشعارات السداد. إذا تُرك فارغاً نستخدم رقم الهاتف."
              />
            </div>
            <Input
              label="العنوان"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="الحي / الشارع"
            />
            <Input
              label="الرصيد الافتتاحي (اختياري)"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              helperText="موجب = نحن مدينون له، سالب = هو مدين لنا (دفعة مقدّمة)."
              data-testid="new-supplier-opening"
            />
            <Input
              label="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="معلومات إضافية"
            />
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => history.goBack()}>
                إلغاء
              </Button>
              <Button
                type="submit"
                isLoading={mutation.isPending}
                disabled={!valid}
                data-testid="new-supplier-submit"
              >
                إنشاء المورّد
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

export default NewSupplierPage;
