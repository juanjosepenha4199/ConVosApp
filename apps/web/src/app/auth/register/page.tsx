'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setTokens } from '@/lib/auth';
import { CONSUMER_EMAIL_HINT, isConsumerEmail, normalizeEmail } from '@/lib/register-validation';
import { useRouter, useSearchParams } from 'next/navigation';

function mapRegisterApiError(raw: string): string {
  if (raw === 'EMAIL_ALREADY_IN_USE' || raw.includes('EMAIL_ALREADY_IN_USE'))
    return 'Este correo ya está registrado.';
  if (raw.includes('INVALID_EMAIL_PROVIDER')) {
    return 'Usa un correo de Gmail, Outlook o Yahoo.';
  }
  if (raw.toLowerCase().includes('password')) return raw;
  return raw;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextQuery = searchParams.toString();
  const loginHref = nextQuery ? `/auth/login?${nextQuery}` : '/auth/login';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const em = normalizeEmail(email);
    if (!isConsumerEmail(em)) {
      setError('Usa un correo de Gmail, Outlook o Yahoo.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({ email: em, password, name: name.trim() || undefined });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      const next =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.push(next && next.startsWith('/') ? next : '/app');
    } catch (err: unknown) {
      const raw = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo crear la cuenta';
      setError(mapRegisterApiError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-5">
      <div className="convos-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Empieza creando un grupo y tu primer plan.</p>

        <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Nombre</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María"
              autoComplete="name"
            />
          </label>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Email</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.nombre@gmail.com"
              required
            />
            <span className="text-xs text-slate-500 dark:text-zinc-500">{CONSUMER_EMAIL_HINT}</span>
          </label>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Contraseña</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </label>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Confirmar contraseña</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              minLength={8}
              placeholder="Repite la contraseña"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          ) : null}

          <button
            className="convos-btn-primary mt-2 h-12 min-h-[48px] w-full disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-600 dark:text-zinc-400">
          ¿Ya tienes cuenta?{' '}
          <Link className="font-semibold text-red-400 hover:text-red-300 hover:underline" href={loginHref}>
            Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="convos-gradient flex min-h-[50vh] items-center justify-center px-5 py-10 text-sm text-slate-600 dark:text-zinc-400">
          Cargando…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
