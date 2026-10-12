'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage, HttpError } from '@/lib/api';
import { stomp } from '@/lib/stomp';
import { SITE } from '@/lib/site';
import { isAdmin, useAuthStore } from '@/store/useAuthStore';
import OAuthButtons from '../layout/OAuthButtons';
import Spinner from '../ui/Spinner';
import GroceryCollage from './GroceryCollage';

type Mode = 'login' | 'register';

function Field({ icon, error, children, trailing }: { icon: ReactNode; error?: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div>
      <div className={clsx('flex items-center gap-2.5 rounded-xl border bg-[#FAFCFA] px-3.5 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100', error ? 'border-red-300' : 'border-line')}>
        <span className="text-ink-muted">{icon}</span>
        {children}
        {trailing}
      </div>
      {error && <p className="mt-1 pl-1 text-[11px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

const inputCls = 'h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-muted';

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="text-ink-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

/* ------------------------------- Sign in ------------------------------- */
const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
type LoginValues = z.infer<typeof loginSchema>;

const DEMO = [
  { label: '🛒 Shopper', email: 'shopper@quickcart.dev', password: 'Shopper@123' },
  { label: '🏬 Store admin', email: 'admin@quickcart.dev', password: 'Admin@123' },
  { label: '🛵 Rider', email: 'rider1.blr-kor-01@quickcart.dev', password: 'Rider@123' },
];

function LoginForm({ next, onDone }: { next: string | null; onDone: (home: string) => void }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, setValue, formState } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = async (v: LoginValues) => {
    try {
      const res = await api.auth.login(v);
      setUser(res.user);
      stomp.reconnect();
      toast.success(`Welcome back, ${res.user.fullName.split(' ')[0]}! 🥬`);
      onDone(isAdmin(res.user) ? '/admin/dashboard' : res.user.role === 'ROLE_DELIVERY_PARTNER' ? '/rider' : '/');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="qc-slide-up space-y-3.5" noValidate>
      <Field icon={<Mail size={16} />} error={formState.errors.email?.message}>
        <input type="email" autoComplete="email" placeholder="Email address" className={inputCls} {...register('email')} />
      </Field>
      <Field icon={<Lock size={16} />} error={formState.errors.password?.message} trailing={<PasswordToggle show={show} onToggle={() => setShow((v) => !v)} />}>
        <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" className={inputCls} {...register('password')} />
      </Field>
      <button type="submit" disabled={formState.isSubmitting} className="btn-primary h-12 w-full rounded-xl text-sm shadow-[0_10px_24px_-10px_rgba(34,160,75,0.8)]">
        {formState.isSubmitting ? <Spinner /> : 'Sign in'}
      </button>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Try a demo:</span>
        {DEMO.map((d) => (
          <button key={d.email} type="button" onClick={() => { setValue('email', d.email); setValue('password', d.password); }} className="chip border border-brand-200 bg-mint text-brand-800 hover:bg-brand-100">
            {d.label}
          </button>
        ))}
      </div>
      {next && <p className="text-[11px] text-ink-muted">You&apos;ll continue to {next} after signing in.</p>}
    </form>
  );
}

/* ----------------------------- Create account ----------------------------- */
const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Tell us your name').max(100),
    email: z.string().trim().email('Enter a valid email'),
    phoneNumber: z.string().trim().regex(/^$|^[+]?[0-9]{10,14}$/, 'Enter a valid phone number').optional(),
    password: z.string().min(8, 'At least 8 characters').max(72).regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms' }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type RegisterValues = z.infer<typeof registerSchema>;

function strength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return [
    { score: 0, label: 'Too short', color: 'bg-zinc-200' },
    { score: 1, label: 'Weak', color: 'bg-red-400' },
    { score: 2, label: 'Okay', color: 'bg-amber-400' },
    { score: 3, label: 'Strong', color: 'bg-brand-400' },
    { score: 4, label: 'Excellent', color: 'bg-brand-600' },
  ][s];
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, setError, watch, formState } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const err = formState.errors;
  const pw = watch('password') ?? '';
  const st = strength(pw);

  const submit = async (v: RegisterValues) => {
    try {
      const res = await api.auth.register({ fullName: v.fullName, email: v.email, phoneNumber: v.phoneNumber || undefined, password: v.password });
      setUser(res.user);
      stomp.reconnect();
      toast.success('Account created — use WELCOME50 on your first order 🎁');
      onDone();
    } catch (e) {
      if (e instanceof HttpError && e.fieldErrors) {
        Object.entries(e.fieldErrors).forEach(([k, m]) => setError(k as keyof RegisterValues, { message: m }));
      }
      toast.error(errorMessage(e));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="qc-slide-up space-y-3" noValidate>
      <Field icon={<User size={16} />} error={err.fullName?.message}>
        <input autoComplete="name" placeholder="Full name" className={inputCls} {...register('fullName')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field icon={<Mail size={16} />} error={err.email?.message}>
          <input type="email" autoComplete="email" placeholder="Email" className={inputCls} {...register('email')} />
        </Field>
        <Field icon={<Phone size={16} />} error={err.phoneNumber?.message}>
          <input type="tel" autoComplete="tel" placeholder="Phone (optional)" className={inputCls} {...register('phoneNumber')} />
        </Field>
      </div>
      <Field icon={<Lock size={16} />} error={err.password?.message} trailing={<PasswordToggle show={show} onToggle={() => setShow((v) => !v)} />}>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Create password" className={inputCls} {...register('password')} />
      </Field>
      {pw && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((i) => <span key={i} className={clsx('h-1 flex-1 rounded-full transition', i <= st.score ? st.color : 'bg-zinc-200')} />)}
          </div>
          <span className="w-16 text-right text-[10px] font-bold text-ink-muted">{st.label}</span>
        </div>
      )}
      <Field icon={<Lock size={16} />} error={err.confirm?.message}>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirm password" className={inputCls} {...register('confirm')} />
      </Field>
      <label className="flex items-start gap-2 px-1 text-[11px] text-ink-soft">
        <input type="checkbox" className="mt-0.5 accent-brand-500" {...register('terms')} />
        <span>I agree to QuickCart&apos;s terms &amp; privacy policy and to receive order updates.</span>
      </label>
      {err.terms && <p className="pl-1 text-[11px] font-semibold text-danger">{err.terms.message}</p>}
      <button type="submit" disabled={formState.isSubmitting} className="btn-primary h-12 w-full rounded-xl text-sm shadow-[0_10px_24px_-10px_rgba(34,160,75,0.8)]">
        {formState.isSubmitting ? <Spinner /> : 'Create account & get ₹100 off'}
      </button>
    </form>
  );
}

/* ------------------------------ Page shell ------------------------------ */
export default function AuthExperience({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    const err = params.get('error');
    if (err) toast.error(err === 'email_missing' ? 'Your social account has no public email. Use email sign-in instead.' : 'Social sign-in failed. Please try again.');
  }, [params]);

  const switchTo = (m: Mode) => {
    setMode(m);
    const q = next ? `?next=${encodeURIComponent(next)}` : '';
    // Keep this component mounted so the tab slider animates; just update the address bar.
    window.history.replaceState(null, '', `/${m}${q}`);
  };

  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
      <div className="hidden lg:block"><GroceryCollage /></div>

      <div className="flex items-center justify-center">
        <div className="w-full max-w-[460px] rounded-[28px] border border-line bg-white p-7 shadow-[0_30px_80px_-30px_rgba(16,40,20,0.25)] sm:p-9">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-xl text-white">🛒</span>
            <div>
              <h1 className="font-display text-2xl font-extrabold">{mode === 'login' ? 'Welcome back!' : 'Join QuickCart'}</h1>
              <p className="text-xs text-ink-muted">{mode === 'login' ? 'Sign in to check out and track orders live.' : 'Fresh groceries at your door in minutes.'}</p>
            </div>
          </div>

          <div className="relative mb-6 grid grid-cols-2 rounded-xl bg-mint p-1 text-sm font-bold">
            <span className={clsx('absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-all duration-300', mode === 'login' ? 'left-1' : 'left-[calc(50%+2px)]')} />
            <button onClick={() => switchTo('login')} className={clsx('relative z-10 py-2.5', mode === 'login' ? 'text-brand-700' : 'text-ink-muted')}>Sign in</button>
            <button onClick={() => switchTo('register')} className={clsx('relative z-10 py-2.5', mode === 'register' ? 'text-brand-700' : 'text-ink-muted')}>Create account</button>
          </div>

          {mode === 'login' ? (
            <LoginForm key="login" next={next} onDone={(home) => router.replace(next ?? home)} />
          ) : (
            <RegisterForm key="register" onDone={() => router.replace(next ?? '/')} />
          )}

          <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase text-ink-muted">
            <span className="h-px flex-1 bg-line" /> or continue with <span className="h-px flex-1 bg-line" />
          </div>
          <OAuthButtons />

          <p className="mt-6 text-center text-[11px] text-ink-muted">
            Need help? Call <a href={SITE.phoneHref} className="font-bold text-brand-700">{SITE.phoneDisplay}</a> or mail{' '}
            <a href={SITE.emailHref} className="font-bold text-brand-700">{SITE.email}</a>
          </p>
          <p className="mt-2 text-center text-[11px]"><Link href="/" className="text-ink-muted hover:text-brand-700">← Back to shopping</Link></p>
        </div>
      </div>
    </div>
  );
}
