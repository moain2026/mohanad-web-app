import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { customersApi } from '@/lib/api/customers';

/**
 * EditCustomerPage — edit an existing customer's mutable fields.
 */
export function EditCustomerPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? '');
      setWhatsappPhone(customer.whatsappPhone ?? '');
      setAddress(customer.address ?? '');
      setNotes(customer.notes ?? '');
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: () =>
      customersApi.update(id, {
        name: name.trim(),
        phone: phone.trim() || null,
        whatsappPhone: whatsappPhone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      } as Parameters<typeof customersApi.update>[1]),
    onSuccess: () => {
      toast.success('تم حفظ التعديلات');
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      history.push(`/customers/${id}`);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'حدث خطأ في حفظ التعديلات');
    },
  });

  const valid = name.trim().length >= 2;

  return (
    <AppShell title="تعديل عميل">
      <PageHeader title="تعديل بيانات العميل" />
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <Card>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (valid) mutation.mutate();
              }}
              data-testid="edit-customer-form"
            >
              <Input
                label="الاسم"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  label="هاتف واتساب"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  inputMode="tel"
                  dir="ltr"
                />
              </div>
              <Input label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
              {error ? (
                <p className="text-xs text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => history.goBack()}>
                  إلغاء
                </Button>
                <Button type="submit" isLoading={mutation.isPending} disabled={!valid}>
                  حفظ التعديلات
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default EditCustomerPage;
