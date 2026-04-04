'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setTokens } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextQuery = searchParams.toString();
  const registerHref = nextQuery ? `/auth/register?${nextQuery}` : '/auth/register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email: email.trim().toLowerCase(), password });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.push(next && next.startsWith('/') ? next : '/app');
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-5">
      <div className="convos-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Entra para crear planes y validarlos con tu grupo.</p>

        <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Email</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@gmail.com"
              required
            />
          </label>
          <label className="convos-label">
            <span className="font-medium text-slate-700 dark:text-zinc-300">Contraseña</span>
            <input
              className="convos-input h-12 min-h-[44px]"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            className="convos-btn-primary mt-2 h-12 min-h-[48px] w-full disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-600 dark:text-zinc-400">
          ¿No tienes cuenta?{' '}
          <Link className="font-semibold text-red-400 hover:text-red-300 hover:underline" href={registerHref}>
            Regístrate
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="convos-gradient flex min-h-[50vh] items-center justify-center px-5 py-10 text-sm text-slate-600 dark:text-zinc-400">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
