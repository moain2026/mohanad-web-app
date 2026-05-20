import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { passwordResetsApi } from '@/lib/api/notification-templates';

type Stage = 'REQUEST' | 'CONFIRM' | 'DONE';

/**
 * ForgotPasswordPage — Phase 8.
 *
 * Two-step flow:
 *   1. REQUEST  — user enters username; server always returns 200 to prevent
 *      enumeration. In development the API echoes back `devToken` for manual
 *      testing — we surface it as a copy-to-clipboard banner.
 *   2. CONFIRM  — user pastes the token (received via WhatsApp / SMS in prod)
 *      and sets a new password.
 */
export function ForgotPasswordPage(): JSX.Element {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('REQUEST');
  const [username, setUsername] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reqMutation = useMutation({
    mutationFn: (u: string) => passwordResetsApi.request(u),
    onSuccess: (res) => {
      setError(null);
      setDevToken(res?.devToken ?? null);
      setStage('CONFIRM');
      toast.success('إذا كان الحساب موجوداً فسوف يصلك رمز التحقق.');
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'فشل إرسال طلب الإعادة');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (vars: { token: string; newPassword: string }) =>
      passwordResetsApi.confirm(vars.token, vars.newPassword),
    onSuccess: () => {
      setStage('DONE');
      toast.success('تم تحديث كلمة المرور بنجاح');
    },
    onError: (err) => {
      const e = extractApiError(err);
      setError(e.message ?? 'فشل تأكيد التحديث — قد يكون الرمز منتهي الصلاحية.');
    },
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-emerald">
      <motion.div
        aria-hidden
        className="absolute -top-40 -end-32 h-96 w-96 rounded-full bg-primary-300/40 blur-3xl"
        animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 11, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 -start-24 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl"
        animate={{ y: [0, -22, 0], x: [0, 14, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 13, ease: 'easeInOut' }}
      />

      <div className="relative z-10 min-h-screen grid place-items-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card glass className="border-white/60 shadow-glow">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow">
                <KeyRound className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold text-ink">إعادة تعيين كلمة المرور</h1>
              <p className="text-sm text-gray-600">
                {stage === 'REQUEST'
                  ? 'أدخل اسم المستخدم وسنرسل لك رمز التحقق.'
                  : stage === 'CONFIRM'
                    ? 'أدخل الرمز الذي وصلك وكلمة المرور الجديدة.'
                    : 'تم بنجاح — يمكنك الآن تسجيل الدخول.'}
              </p>
            </div>

            {stage === 'REQUEST' ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!username.trim()) return;
                  reqMutation.mutate(username.trim());
                }}
                data-testid="forgot-request-form"
              >
                <Input
                  label="اسم المستخدم"
                  leftIcon={<User className="h-4 w-4" />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  data-testid="forgot-username"
                />
                {error ? (
                  <p className="text-xs text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={reqMutation.isPending}
                  disabled={!username.trim() || reqMutation.isPending}
                  data-testid="forgot-request-submit"
                >
                  إرسال رمز التحقق
                </Button>
              </form>
            ) : null}

            {stage === 'CONFIRM' ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!token.trim() || !newPassword) return;
                  confirmMutation.mutate({ token: token.trim(), newPassword });
                }}
                data-testid="forgot-confirm-form"
              >
                {devToken ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p className="font-semibold">رمز التطوير (ظاهر فقط في غير الإنتاج):</p>
                    <code
                      className="block break-all font-mono"
                      data-testid="forgot-dev-token"
                    >
                      {devToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => setToken(devToken)}
                      className="mt-1 text-primary-700 underline"
                    >
                      استخدم هذا الرمز
                    </button>
                  </div>
                ) : null}
                <Input
                  label="رمز التحقق"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ألصق الرمز هنا"
                  data-testid="forgot-token"
                />
                <Input
                  label="كلمة المرور الجديدة"
                  type="password"
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="forgot-new-password"
                />
                {error ? (
                  <p className="text-xs text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={confirmMutation.isPending}
                  disabled={!token.trim() || newPassword.length < 8 || confirmMutation.isPending}
                  data-testid="forgot-confirm-submit"
                >
                  تأكيد كلمة المرور الجديدة
                </Button>
              </form>
            ) : null}

            {stage === 'DONE' ? (
              <div className="mt-6 text-center">
                <p className="mb-4 text-sm text-emerald-700">
                  تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.
                </p>
                <Link to="/login">
                  <Button fullWidth size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    الذهاب لتسجيل الدخول
                  </Button>
                </Link>
              </div>
            ) : null}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5 text-primary-600" />
              <span>الرمز صالح لمدة ساعة واحدة فقط</span>
            </p>

            <p className="mt-2 text-center text-xs text-gray-500">
              <Link to="/login" className="text-primary-700 underline">
                العودة لتسجيل الدخول
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
