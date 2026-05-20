import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import {
  type NotificationTemplate,
  templatesApi,
} from '@/lib/api/notification-templates';

type Editable = {
  id?: string;
  key: string;
  name: string;
  channel: 'INTERNAL' | 'WHATSAPP';
  bodyTemplate: string;
  placeholders: string[];
  isActive: boolean;
};

function defaultDraft(): Editable {
  return {
    key: '',
    name: '',
    channel: 'INTERNAL',
    bodyTemplate: '',
    placeholders: [],
    isActive: true,
  };
}

/**
 * NotificationTemplatesPage — Phase 8.
 * Allows admins to edit message templates (system + custom) with {{placeholder}}
 * substitution. System templates can't be deleted but can be edited.
 */
export function NotificationTemplatesPage(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Editable | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => templatesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (body: Editable) =>
      templatesApi.create({
        key: body.key,
        name: body.name,
        channel: body.channel,
        bodyTemplate: body.bodyTemplate,
        placeholders: body.placeholders,
        isActive: body.isActive,
      }),
    onSuccess: () => {
      toast.success('تم إنشاء القالب');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['notification-templates'] });
    },
    onError: (err) => toast.error(extractApiError(err).message ?? 'فشل الإنشاء'),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Editable) =>
      templatesApi.update(body.id ?? '', {
        name: body.name,
        channel: body.channel,
        bodyTemplate: body.bodyTemplate,
        placeholders: body.placeholders,
        isActive: body.isActive,
      }),
    onSuccess: () => {
      toast.success('تم تحديث القالب');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['notification-templates'] });
    },
    onError: (err) => toast.error(extractApiError(err).message ?? 'فشل التحديث'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      toast.success('تم حذف القالب');
      void qc.invalidateQueries({ queryKey: ['notification-templates'] });
    },
    onError: (err) => toast.error(extractApiError(err).message ?? 'فشل الحذف'),
  });

  function startEdit(t: NotificationTemplate): void {
    setEditing({
      id: t.id,
      key: t.key,
      name: t.name,
      channel: t.channel,
      bodyTemplate: t.bodyTemplate,
      placeholders: t.placeholdersJson ?? [],
      isActive: t.isActive,
    });
  }

  function save(): void {
    if (!editing) return;
    if (editing.id) updateMutation.mutate(editing);
    else createMutation.mutate(editing);
  }

  return (
    <AppShell title="قوالب الإشعارات">
      <PageHeader
        title="قوالب الإشعارات"
        description="عدّل نصوص الرسائل الداخلية ورسائل واتساب — يمكن استخدام placeholders مثل {{customer_name}}."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing(defaultDraft())}>
            قالب جديد
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {['s0', 's1', 's2'].map((k) => (
              <Skeleton key={k} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل القوالب"
            description="حاول مرة أخرى."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="لا توجد قوالب بعد"
            description="ستظهر القوالب الافتراضية تلقائياً بعد أول تشغيل."
            icon={MessageSquare}
          />
        ) : (
          <ul className="space-y-3" data-testid="templates-list">
            {data.map((t) => (
              <li key={t.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-ink">{t.name}</h3>
                        <Badge variant={t.channel === 'WHATSAPP' ? 'success' : 'primary'}>
                          {t.channel === 'WHATSAPP' ? 'واتساب' : 'داخلي'}
                        </Badge>
                        {t.isSystem ? <Badge variant="warning">نظام</Badge> : null}
                        {!t.isActive ? <Badge variant="danger">معطّل</Badge> : null}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-500">{t.key}</p>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
                        {t.bodyTemplate}
                      </pre>
                      {t.placeholdersJson && t.placeholdersJson.length > 0 ? (
                        <p className="mt-1 text-xs text-gray-500">
                          المتغيرات:{' '}
                          {t.placeholdersJson.map((p) => (
                            <code key={p} className="me-1 rounded bg-gray-100 px-1">
                              {`{{${p}}}`}
                            </code>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Pencil className="h-4 w-4" />}
                        onClick={() => startEdit(t)}
                        data-testid={`template-edit-${t.key}`}
                      >
                        تعديل
                      </Button>
                      {!t.isSystem ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="h-4 w-4" />}
                          onClick={() => {
                            if (confirm(`حذف القالب "${t.name}"؟`)) deleteMutation.mutate(t.id);
                          }}
                        >
                          حذف
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'تعديل قالب' : 'قالب جديد'}
          size="lg"
        >
          <div className="space-y-3">
            {!editing.id ? (
              <Input
                label="مفتاح القالب (latin lowercase only)"
                value={editing.key}
                onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                placeholder="مثل: monthly_reminder"
                data-testid="template-key"
              />
            ) : null}
            <Input
              label="الاسم"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              data-testid="template-name"
            />
            <div>
              <label htmlFor="t-channel" className="block text-xs font-semibold text-gray-700 mb-1">
                القناة
              </label>
              <select
                id="t-channel"
                value={editing.channel}
                onChange={(e) =>
                  setEditing({ ...editing, channel: e.target.value as 'INTERNAL' | 'WHATSAPP' })
                }
                className="form-select h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                data-testid="template-channel"
              >
                <option value="INTERNAL">داخلي (داخل التطبيق)</option>
                <option value="WHATSAPP">واتساب</option>
              </select>
            </div>
            <div>
              <label htmlFor="t-body" className="block text-xs font-semibold text-gray-700 mb-1">
                نص الرسالة (استخدم {`{{placeholder}}`} للمتغيرات)
              </label>
              <textarea
                id="t-body"
                value={editing.bodyTemplate}
                onChange={(e) => setEditing({ ...editing, bodyTemplate: e.target.value })}
                rows={6}
                className="form-textarea w-full rounded-md border border-gray-200 bg-white p-3 text-sm font-mono"
                data-testid="template-body"
              />
            </div>
            <Input
              label="المتغيرات (مفصولة بفاصلة)"
              value={editing.placeholders.join(',')}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  placeholders: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="customer_name, debt_amount"
              data-testid="template-placeholders"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <span>القالب مُفعَّل</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
              <Button
                onClick={save}
                isLoading={createMutation.isPending || updateMutation.isPending}
                disabled={!editing.name || !editing.bodyTemplate || (!editing.id && !editing.key)}
                data-testid="template-save"
              >
                حفظ
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}

export default NotificationTemplatesPage;
