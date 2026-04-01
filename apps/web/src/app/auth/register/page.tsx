'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { setTokens } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextQuery = searchParams.toString();
  const loginHref = nextQuery ? `/auth/login?${nextQuery}` : '/auth/login';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({ email, password, name });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.push(next && next.startsWith('/') ? next : '/app');
    } catch (err: unknown) {
      const raw = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo crear la cuenta';
      const friendly =
        raw === 'EMAIL_ALREADY_IN_USE'
          ? 'Ese correo ya está registrado. Inicia sesión o usa otro email.'
          : raw;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div className="convos-card p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-600">
          Empieza creando un grupo y tu primer plan.
        </p>

        <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              className="h-11 rounded-xl border border-violet-100 bg-white/90 px-3 outline-none transition-shadow focus:ring-4 focus:ring-violet-200/80"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              className="h-11 rounded-xl border border-violet-100 bg-white/90 px-3 outline-none transition-shadow focus:ring-4 focus:ring-violet-200/80"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Contraseña</span>
            <input
              className="h-11 rounded-xl border border-violet-100 bg-white/90 px-3 outline-none transition-shadow focus:ring-4 focus:ring-violet-200/80"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            className="convos-btn-primary mt-2 h-12 w-full disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link className="font-semibold text-violet-700 hover:underline" href={loginHref}>
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
        <div className="convos-gradient flex min-h-[50vh] items-center justify-center px-5 py-10 text-sm text-slate-600">
          Cargando…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
