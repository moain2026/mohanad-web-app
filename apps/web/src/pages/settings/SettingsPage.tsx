import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { settingsApi } from '@/lib/api/settings';
import { DEFAULT_STORE_SETTINGS, SETTING_KEYS } from '@grocery/shared';

type SettingsForm = Record<string, unknown>;

interface FieldDef {
  key: string;
  label: string;
  description?: string;
  kind: 'text' | 'number' | 'boolean' | 'select';
  options?: Array<{ value: string; label: string }>;
}

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'بيانات المتجر',
    fields: [
      { key: SETTING_KEYS.STORE_NAME, label: 'اسم المتجر', kind: 'text' },
      {
        key: SETTING_KEYS.STORE_CURRENCY,
        label: 'العملة',
        kind: 'select',
        options: [
          { value: 'YER', label: 'ريال يمني (YER)' },
          { value: 'SAR', label: 'ريال سعودي (SAR)' },
          { value: 'USD', label: 'دولار أمريكي (USD)' },
          { value: 'AED', label: 'درهم إماراتي (AED)' },
        ],
      },
      { key: SETTING_KEYS.STORE_PHONE, label: 'هاتف المتجر', kind: 'text' },
      { key: SETTING_KEYS.STORE_ADDRESS, label: 'عنوان المتجر', kind: 'text' },
      {
        key: SETTING_KEYS.LOCALE,
        label: 'لغة الواجهة',
        kind: 'select',
        options: [
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ],
      },
    ],
  },
  {
    title: 'المبيعات والمعاملات',
    fields: [
      {
        key: SETTING_KEYS.DEFAULT_SALE_MODE,
        label: 'نمط البيع الافتراضي',
        kind: 'select',
        options: [
          { value: 'QUICK', label: 'سريع' },
          { value: 'DETAILED', label: 'تفصيلي' },
          { value: 'CREDIT', label: 'بالأجل' },
        ],
      },
      {
        key: SETTING_KEYS.LARGE_TX_THRESHOLD,
        label: 'حد المعاملة الكبيرة (للتنبيه الداخلي)',
        kind: 'number',
        description: 'تنبيه داخلي عند تجاوز المبيعة هذا المبلغ.',
      },
      {
        key: SETTING_KEYS.OPENING_CASH_BALANCE,
        label: 'رصيد الصندوق الافتتاحي الافتراضي',
        kind: 'number',
      },
    ],
  },
  {
    title: 'العملاء',
    fields: [
      {
        key: SETTING_KEYS.CREDIT_LIMIT_DEFAULT,
        label: 'حد الائتمان الافتراضي للعميل',
        kind: 'number',
      },
      {
        key: SETTING_KEYS.BEHAVIOR_INACTIVE_DAYS,
        label: 'عدد أيام الخمول قبل اعتبار العميل غير نشط',
        kind: 'number',
      },
      {
        key: SETTING_KEYS.DEBT_AGING_WARN_DAYS,
        label: 'عدد أيام تقادم الدين للتحذير',
        kind: 'number',
      },
    ],
  },
  {
    title: 'الإشعارات والتذكيرات',
    fields: [
      {
        key: SETTING_KEYS.NOTIFICATIONS_WHATSAPP_ENABLED,
        label: 'تفعيل إشعارات واتساب',
        kind: 'boolean',
      },
      {
        key: SETTING_KEYS.REMINDER_DAY_OF_MONTH,
        label: 'يوم التذكير الشهري (1-28)',
        kind: 'number',
      },
    ],
  },
  {
    title: 'المخزون',
    fields: [
      {
        key: SETTING_KEYS.INVENTORY_ENABLED,
        label: 'تفعيل وحدة المخزون',
        kind: 'boolean',
        description: 'يجب تفعيل المخزون لاستخدام صفحات المنتجات والحركات.',
      },
    ],
  },
];

/**
 * SettingsPage — Phase 7.
 * Edits the per-store key/value Setting table with strict per-key validation.
 */
export function SettingsPage(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  useEffect(() => {
    if (data) {
      const merged: SettingsForm = { ...DEFAULT_STORE_SETTINGS, ...data };
      setForm(merged);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(form).map(([key, value]) => ({ key, value }));
      return settingsApi.upsertMany(items);
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast.error(e.message ?? 'فشل حفظ الإعدادات');
    },
  });

  function setField(key: string, value: unknown): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <AppShell title="الإعدادات">
        <PageHeader title="الإعدادات" />
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
          {['s0', 's1', 's2'].map((k) => (
            <Skeleton key={k} className="h-40 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="الإعدادات">
        <PageHeader title="الإعدادات" />
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <Card>
            <p className="text-sm text-red-600">تعذَّر تحميل الإعدادات.</p>
            <div className="mt-2">
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="الإعدادات">
      <PageHeader
        title="الإعدادات"
        actions={
          <Button
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            leftIcon={<Save className="h-4 w-4" />}
            data-testid="settings-save"
          >
            حفظ التغييرات
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {SECTIONS.map((section) => (
          <Card key={section.title} header={section.title}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {section.fields.map((f) => {
                const value = form[f.key];
                if (f.kind === 'boolean') {
                  return (
                    <label
                      key={f.key}
                      className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => setField(f.key, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1"
                        data-testid={`settings-${f.key}`}
                      />
                      <span className="text-sm">
                        <span className="block font-medium text-ink">{f.label}</span>
                        {f.description ? (
                          <span className="block text-xs text-gray-500">{f.description}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                }
                if (f.kind === 'select') {
                  return (
                    <div key={f.key}>
                      <label
                        htmlFor={`s-${f.key}`}
                        className="block text-xs font-semibold text-gray-700 mb-1"
                      >
                        {f.label}
                      </label>
                      <select
                        id={`s-${f.key}`}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                        data-testid={`settings-${f.key}`}
                      >
                        {f.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {f.description ? (
                        <p className="mt-1 text-xs text-gray-500">{f.description}</p>
                      ) : null}
                    </div>
                  );
                }
                // text or number
                return (
                  <div key={f.key}>
                    <Input
                      label={f.label}
                      type={f.kind === 'number' ? 'number' : 'text'}
                      inputMode={f.kind === 'number' ? 'decimal' : undefined}
                      value={value === null || value === undefined ? '' : String(value)}
                      onChange={(e) => {
                        if (f.kind === 'number') {
                          const n = e.target.value === '' ? 0 : Number(e.target.value);
                          setField(f.key, Number.isFinite(n) ? n : 0);
                        } else {
                          setField(f.key, e.target.value || null);
                        }
                      }}
                      data-testid={`settings-${f.key}`}
                    />
                    {f.description ? (
                      <p className="mt-1 text-xs text-gray-500">{f.description}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              <SettingsIcon className="inline h-4 w-4 me-1" />
              يتم حفظ الإعدادات في قاعدة البيانات لكل متجر، مع تسجيل سجلّ تدقيق.
            </p>
            <Button
              onClick={() => mutation.mutate()}
              isLoading={mutation.isPending}
              leftIcon={<Save className="h-4 w-4" />}
            >
              حفظ التغييرات
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export default SettingsPage;
