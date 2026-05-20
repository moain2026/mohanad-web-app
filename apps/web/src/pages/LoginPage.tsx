import { type LoginInput, loginSchema } from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Sparkles, Store, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHistory, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/i18n/ar';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

interface LockoutInfo {
  lockedUntil: string; // ISO date
  retryAfterSec?: number;
}

interface ErrorEnvelopeBody {
  data: null;
  meta?: {
    error?: {
      statusCode?: number;
      code?: string;
      message?: string;
      lockedUntil?: string;
      retryAfterSec?: number;
    };
  };
}

/**
 * LoginPage — Phase 2 P2-5 (real authentication).
 *
 *   • RHF + Zod (`loginSchema` from @grocery/shared).
 *   • On 200 → fire Arabic welcome toast `مرحباً <fullName>!` and
 *     redirect to /dashboard (or back to the URL the ProtectedRoute
 *     captured in `location.state.from`).
 *   • On 429 (account lockout) → render an MM:SS countdown timer
 *     under the form, disable the submit button, and re-enable it the
 *     moment the timer hits 00:00.
 *   • On 401 → toast invalid credentials.
 */
export function LoginPage(): JSX.Element {
  const toast = useToast();
  const history = useHistory();
  const location = useLocation<{ from?: { pathname: string } }>();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [lockout, setLockout] = useState<LockoutInfo | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', rememberMe: false },
  });

  // ── Already authenticated? bounce to dashboard ──
  useEffect(() => {
    if (isAuthenticated) {
      const dest = location.state?.from?.pathname ?? '/dashboard';
      history.replace(dest);
    }
  }, [isAuthenticated, history, location.state]);

  // ── Lockout countdown tick (every second) ──
  useEffect(() => {
    if (!lockout) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockout]);

  // Auto-clear when timer expires
  const remainingMs = useMemo(() => {
    if (!lockout) return 0;
    return Math.max(0, new Date(lockout.lockedUntil).getTime() - now);
  }, [lockout, now]);

  useEffect(() => {
    if (lockout && remainingMs <= 0) setLockout(null);
  }, [lockout, remainingMs]);

  const mmss = useMemo(() => {
    const sec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [remainingMs]);

  const onSubmit = handleSubmit(async (values) => {
    if (lockout) return; // hard guard — UI already disables the button
    try {
      const user = await login(values);
      toast.success(`${t('login.welcome')} ${user.fullName}!`);
      const dest = location.state?.from?.pathname ?? '/dashboard';
      history.replace(dest);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: ErrorEnvelopeBody } };
      const status = e?.response?.status;
      const body = e?.response?.data?.meta?.error;

      if (status === 429 && body?.lockedUntil) {
        setLockout({
          lockedUntil: body.lockedUntil,
          retryAfterSec: body.retryAfterSec,
        });
        setNow(Date.now());
        return;
      }
      if (status === 401) {
        toast.error(body?.message ?? t('login.invalidCredentials'));
        return;
      }
      if (status === 422) {
        toast.error(body?.message ?? 'بيانات غير صالحة');
        return;
      }
      toast.error(body?.message ?? t('login.networkError'));
    }
  });

  const submitDisabled = isLoading || isSubmitting || lockout !== null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-emerald">
      {/* Floating glass orbs */}
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
      <motion.div
        aria-hidden
        className="absolute top-1/3 start-1/4 h-48 w-48 rounded-full bg-white/40 blur-3xl"
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 7, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 bg-grain opacity-60 mix-blend-multiply pointer-events-none" />

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
                <Store className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold text-ink">{t('app.name')}</h1>
              <p className="text-sm text-gray-600">{t('login.subtitle')}</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Input
                label={t('login.username')}
                placeholder={t('login.usernamePlaceholder')}
                leftIcon={<User className="h-4 w-4" />}
                autoComplete="username"
                errorText={errors.username?.message}
                {...register('username')}
              />
              <Input
                label={t('login.password')}
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
                errorText={errors.password?.message}
                {...register('password')}
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    {...register('rememberMe')}
                  />
                  {t('login.rememberMe')}
                </label>
                {/*
                  "نسيت كلمة المرور" is intentionally hidden until the password-reset
                  endpoint ships (currently scheduled with the Phase 8 notifications
                  work). Showing a button that only fires a toast was confusing.
                */}
              </div>

              {/* Lockout countdown banner */}
              {lockout ? (
                <div
                  role="alert"
                  aria-live="polite"
                  data-testid="lockout-banner"
                  className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t('login.lockedUntil')}</span>
                    <span
                      data-testid="lockout-countdown"
                      className="font-mono text-xl font-bold tabular-nums"
                    >
                      {mmss}
                    </span>
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isLoading || isSubmitting}
                disabled={submitDisabled}
              >
                {lockout
                  ? `${t('login.lockedUntil')} ${mmss}`
                  : isLoading || isSubmitting
                    ? t('login.submitting')
                    : t('login.submit')}
              </Button>
            </form>

            <p
              className={cn('mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-500')}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary-600" />
              <span>اتصال آمن — Helmet + CORS مُفعَّل</span>
            </p>
          </Card>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-primary-900/70">
            <Sparkles className="h-3.5 w-3.5" />
            مصادقة المرحلة 2 — JWT + رمز تحديث آمن (cookie)
          </p>
        </motion.div>
      </div>
    </div>
  );
}
