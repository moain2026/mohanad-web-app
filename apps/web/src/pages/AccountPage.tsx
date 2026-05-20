import { type ChangePasswordInput, changePasswordSchema } from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, KeyRound, LogOut, Phone, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';

import { SessionsList } from '@/components/account/SessionsList';
import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

function formatDateTimeAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-EG')} · ${d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function AccountPage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logoutAll = useAuthStore((s) => s.logoutAll);

  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (values.newPassword === values.currentPassword) {
      setError('newPassword', {
        message: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية',
      });
      return;
    }
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      toast.success('تم تغيير كلمة المرور — يرجى تسجيل الدخول من جديد');
      reset();
      // changePassword in authStore clears the session — redirect:
      history.replace('/login');
    } catch (err) {
      const e = extractApiError(err);
      // Highlight 401/INVALID_PASSWORD on the current field
      if (e.code === 'INVALID_CURRENT_PASSWORD' || e.statusCode === 401) {
        setError('currentPassword', { message: e.message ?? 'كلمة المرور الحالية غير صحيحة' });
        return;
      }
      setServerError(e.message ?? 'فشل تغيير كلمة المرور');
    }
  });

  const handleLogoutAll = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logoutAll();
      toast.success('تم تسجيل الخروج من جميع الأجهزة');
      history.replace('/login');
    } catch (err) {
      const e = extractApiError(err);
      toast.error(e.message ?? 'فشل تسجيل الخروج من جميع الأجهزة');
    } finally {
      setIsLoggingOut(false);
      setConfirmLogoutAll(false);
    }
  };

  if (!user) {
    return (
      <AppShell title="حسابي">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-sm text-gray-500">جاري تحميل بيانات الحساب…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="حسابي">
      <div className="max-w-4xl mx-auto px-4 py-6 desktop:py-8 space-y-6">
        <Breadcrumbs items={[{ label: 'حسابي' }]} />
        <PageHeader
          eyebrow="P2-6 · الإعدادات"
          title="حسابي"
          description="عرض بيانات حسابك، تغيير كلمة المرور، وإدارة جلساتك."
        />

        {/* ─── Profile ─── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <Avatar name={user.fullName} size="lg" className="h-20 w-20 text-xl" />
              <div className="flex-1 text-center sm:text-start space-y-2">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{user.fullName}</h2>
                  <p dir="ltr" className="text-sm text-gray-500 font-mono">
                    @{user.username}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {user.roles.map((r) => (
                    <Badge key={r} variant="primary">
                      {r}
                    </Badge>
                  ))}
                </div>
                <dl className="grid gap-3 sm:grid-cols-2 pt-3 mt-2 border-t border-gray-100 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" aria-hidden />
                    <div>
                      <dt className="text-xs text-gray-500">الهاتف</dt>
                      <dd dir="ltr" className="text-ink">
                        —
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                    <div>
                      <dt className="text-xs text-gray-500">آخر دخول</dt>
                      <dd className="text-ink text-xs">{formatDateTimeAr(user.lastLoginAt)}</dd>
                    </div>
                  </div>
                </dl>
                <p className="text-xs text-gray-400 pt-2">
                  لتعديل بياناتك الشخصية اتصل بمدير المتجر — لا يمكن تعديلها هنا في الإصدار الحالي.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ─── Change password ─── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card
            header={
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary-600" aria-hidden />
                تغيير كلمة المرور
              </span>
            }
          >
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="password"
                label="كلمة المرور الحالية"
                required
                autoComplete="current-password"
                errorText={errors.currentPassword?.message}
                {...register('currentPassword')}
              />
              <div>
                <Input
                  type="password"
                  label="كلمة المرور الجديدة"
                  required
                  autoComplete="new-password"
                  errorText={errors.newPassword?.message}
                  {...register('newPassword')}
                />
                <div className="mt-2">
                  <PasswordStrengthMeter password={newPassword ?? ''} />
                </div>
              </div>
              <Input
                type="password"
                label="تأكيد كلمة المرور الجديدة"
                required
                autoComplete="new-password"
                errorText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              {serverError ? (
                <p className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <XCircle className="inline h-4 w-4 me-1" />
                  {serverError}
                </p>
              ) : null}

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                  تغيير كلمة المرور
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>

        {/* ─── Active sessions list ─── */}
        <SessionsList />

        {/* ─── Security: logout-all ─── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            header={
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
                أمان الحساب
              </span>
            }
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">تسجيل الخروج من جميع الأجهزة</p>
                <p className="text-xs text-gray-500">
                  إلغاء جميع الجلسات النشطة لحسابك (بما فيها هذا الجهاز).
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut className="h-4 w-4" />}
                onClick={() => setConfirmLogoutAll(true)}
              >
                تسجيل الخروج من الكل
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ─── Confirm logout-all ─── */}
      <ConfirmDialog
        open={confirmLogoutAll}
        title="تسجيل الخروج من جميع الأجهزة"
        message="سيتم إنهاء جلستك على هذا الجهاز وعلى أي جهاز آخر سجلت دخولاً منه. ستحتاج لإعادة تسجيل الدخول."
        confirmLabel="تأكيد الخروج"
        intent="danger"
        isLoading={isLoggingOut}
        onClose={() => setConfirmLogoutAll(false)}
        onConfirm={handleLogoutAll}
      />
    </AppShell>
  );
}
