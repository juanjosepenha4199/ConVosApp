'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/** Acepta el token solo o la URL completa `.../app/join?token=...`. */
function extractInviteToken(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (!t.includes('token=')) return t;
  try {
    if (t.startsWith('http://') || t.startsWith('https://')) {
      const q = new URL(t).searchParams.get('token');
      if (q) return q;
    } else {
      const path = t.startsWith('/') ? t : `/${t}`;
      const q = new URL(path, 'https://convos.local').searchParams.get('token');
      if (q) return q;
    }
  } catch {
    /* regex abajo */
  }
  const m = t.match(/[?&]token=([^&]+)/);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return t;
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get('token') ?? '';

  const [tokenInput, setTokenInput] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveToken = extractInviteToken(tokenInput) || tokenInput.trim();
  const joinNext =
    effectiveToken.length > 0 ? `/app/join?token=${encodeURIComponent(effectiveToken)}` : '/app/join';
  const registerHref = `/auth/register?next=${encodeURIComponent(joinNext)}`;
  const loginHref = `/auth/login?next=${encodeURIComponent(joinNext)}`;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access) {
      router.push(loginHref);
      return;
    }
    const t = extractInviteToken(tokenInput);
    if (!t) return;
    if (t !== tokenInput.trim()) setTokenInput(t);
    setLoading(true);
    setError(null);
    try {
      const res = await api.groups.joinByToken(access, t);
      router.replace(`/app/groups/${res.groupId}`);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo unir al grupo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="convos-card mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Unirte a un grupo</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pega el enlace completo o solo el token. Si aún no tienes sesión, te pediremos iniciar sesión y volverás aquí.
      </p>

      <form className="mt-6 grid gap-3" onSubmit={join}>
        <label className="convos-label">
          <span className="font-medium">Token o enlace</span>
          <input
            className="convos-input font-mono text-xs"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="https://…/app/join?token=…"
          />
        </label>
        <p className="text-xs text-slate-500">
          También vale pegar la URL entera: detectamos el token automáticamente.
        </p>

        {error ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <button type="submit" className="convos-btn-primary h-12 w-full disabled:opacity-60" disabled={loading || !effectiveToken}>
          {loading ? 'Uniendo…' : 'Unirme'}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
        <div>
          ¿Necesitas cuenta?{' '}
          <Link className="font-semibold text-violet-700 hover:underline" href={registerHref}>
            Regístrate
          </Link>
          {' · '}
          <Link className="font-semibold text-violet-700 hover:underline" href={loginHref}>
            Iniciar sesión
          </Link>
        </div>
        <div>
          <Link className="font-semibold text-violet-700 hover:underline" href="/app">
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="convos-gradient flex min-h-[calc(100vh-0px)] flex-col justify-center px-5 py-10">
      <Suspense
        fallback={
          <div className="convos-card mx-auto w-full max-w-md p-8 text-center text-sm text-slate-600">Cargando…</div>
        }
      >
        <JoinContent />
      </Suspense>
    </div>
  );
}
