import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FolderTree, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { type ExpenseCategory, expenseCategoriesApi } from '@/lib/api/expenses';

const PAGE_SIZE = 20;

/**
 * ExpenseCategoriesPage — Phase 5 Frontend.
 *
 *   Admin-style CRUD for expense categories.
 *   Gated by `expense_categories.manage` (insert/edit/delete) — read is open.
 */
export function ExpenseCategoriesPage(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);

  const queryParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, includeInactive }),
    [page, includeInactive],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['expense-categories', queryParams],
    queryFn: () => expenseCategoriesApi.list(queryParams),
  });
  const totalPages = data?.meta.totalPages ?? 1;

  // ─── Create / Edit modal state ───────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (c: ExpenseCategory) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? '');
    setFormError(null);
    setModalOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || undefined };
      return editingId
        ? expenseCategoriesApi.update(editingId, body)
        : expenseCategoriesApi.create(body);
    },
    onSuccess: () => {
      toast.success(editingId ? 'تم تحديث الفئة' : 'تم إنشاء الفئة');
      qc.invalidateQueries({ queryKey: ['expense-categories'] });
      setModalOpen(false);
    },
    onError: (err) => {
      const e = extractApiError(err);
      setFormError(e.message ?? 'تعذَّر حفظ الفئة');
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => expenseCategoriesApi.remove(id),
    onSuccess: () => {
      toast.success('تم تعطيل الفئة');
      qc.invalidateQueries({ queryKey: ['expense-categories'] });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast.error(e.message ?? 'تعذَّر تعطيل الفئة');
    },
  });

  return (
    <AppShell title="فئات المصروفات">
      <PageHeader
        title="فئات المصروفات"
        actions={
          <PermissionGate permission="expense_categories.manage">
            <Button
              leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}
              onClick={openCreate}
              data-testid="new-expense-category"
            >
              فئة جديدة
            </Button>
          </PermissionGate>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <Card>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
              className="form-checkbox h-4 w-4 rounded border-gray-300 text-primary-600"
              data-testid="expense-categories-include-inactive"
            />
            إظهار الفئات المُعطَّلة
          </label>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="expense-categories-loading">
            {['c0', 'c1', 'c2'].map((k) => (
              <Skeleton key={k} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="تعذَّر تحميل الفئات"
            description="حدث خطأ في الشبكة."
            action={
              <Button onClick={() => refetch()} variant="secondary">
                إعادة المحاولة
              </Button>
            }
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="لا توجد فئات بعد"
            description="ابدأ بإنشاء فئة لتصنيف مصروفاتك (مثل: كهرباء، نقل، إيجار)."
            icon={FolderTree}
            action={
              <PermissionGate permission="expense_categories.manage">
                <Button
                  leftIcon={<PlusCircle className="h-4 w-4" aria-hidden />}
                  onClick={openCreate}
                >
                  فئة جديدة
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="expense-categories-list">
              {data.items.map((c) => (
                <li key={c.id}>
                  <Card>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-ink truncate">{c.name}</h3>
                          {!c.isActive ? (
                            <Badge variant="neutral">معطَّلة</Badge>
                          ) : (
                            <Badge variant="success">نشطة</Badge>
                          )}
                        </div>
                        {c.description ? (
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                            {c.description}
                          </p>
                        ) : null}
                      </div>
                      <PermissionGate permission="expense_categories.manage">
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                            aria-label="تعديل"
                            data-testid={`edit-expense-category-${c.id}`}
                            leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
                          >
                            تعديل
                          </Button>
                          {c.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (
                                  // eslint-disable-next-line no-alert
                                  window.confirm(`تعطيل الفئة "${c.name}"؟`)
                                ) {
                                  removeMut.mutate(c.id);
                                }
                              }}
                              aria-label="تعطيل"
                              data-testid={`remove-expense-category-${c.id}`}
                              leftIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                            >
                              تعطيل
                            </Button>
                          ) : null}
                        </div>
                      </PermissionGate>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div
                className="flex items-center justify-between"
                data-testid="expense-categories-pagination"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                >
                  السابق
                </Button>
                <span className="text-xs text-gray-500">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
                >
                  التالي
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'تعديل فئة المصروف' : 'فئة مصروف جديدة'}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (name.trim().length >= 1) saveMut.mutate();
          }}
          data-testid="expense-category-form"
        >
          <Input
            label="اسم الفئة"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثل: كهرباء، إيجار، نقل"
            data-testid="expense-category-name"
          />
          <Input
            label="الوصف (اختياري)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ملاحظات تعريفية للفئة"
          />
          {formError ? (
            <p className="text-xs text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              تراجع
            </Button>
            <Button
              type="submit"
              isLoading={saveMut.isPending}
              disabled={name.trim().length < 1}
              data-testid="expense-category-submit"
            >
              {editingId ? 'حفظ التعديل' : 'إنشاء الفئة'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default ExpenseCategoriesPage;
