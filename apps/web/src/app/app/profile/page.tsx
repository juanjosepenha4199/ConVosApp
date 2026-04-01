'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, uploadPublicUrl, type ProfileActivityResponse } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

function validationStatusLabel(s: string) {
  switch (s) {
    case 'accepted':
      return 'Aceptada';
    case 'rejected':
      return 'Rechazada';
    case 'pending_review':
      return 'En revisión';
    default:
      return s;
  }
}

function pointsReasonLabel(r: string) {
  switch (r) {
    case 'plan_completed':
      return 'Plan completado';
    case 'streak_bonus':
      return 'Bonus racha';
    case 'creative_bonus':
      return 'Bonus creativo';
    case 'cancel_penalty':
      return 'Penalización cancelación';
    case 'mission_completed':
      return 'Misión';
    case 'admin_adjustment':
      return 'Ajuste';
    default:
      return r;
  }
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    setError(null);
    try {
      const act = await api.meActivity(token);
      setData(act);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cargar el perfil';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const me = await fetchMeWithRefresh();
      if (!me) {
        router.replace('/auth/login');
        return;
      }
      await load();
    })();
  }, [load, router]);

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm font-medium text-violet-600/90 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 bg-gradient-to-r from-violet-700 to-cyan-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Mi perfil
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="convos-card p-8 text-center text-sm text-slate-600">Cargando…</div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : data ? (
        <>
          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-800">Resumen</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div>
                <div className="text-slate-500">Nombre</div>
                <div className="font-semibold text-slate-800">{data.user.name ?? data.user.email}</div>
              </div>
              <div>
                <div className="text-slate-500">Nivel</div>
                <div className="font-semibold text-violet-800">{data.user.level}</div>
              </div>
              <div>
                <div className="text-slate-500">Puntos totales</div>
                <div className="font-semibold text-violet-800">{data.user.totalPoints}</div>
              </div>
            </div>
          </section>

          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-800">Planes que validaste (fotos + detalle)</h2>
            <p className="mt-1 text-xs text-slate-600">
              Cada tarjeta es un plan donde enviaste foto y GPS. La imagen aparece después de subirla al validar.
            </p>
            {!data.validations.length ? (
              <p className="mt-4 text-sm text-slate-600">Aún no hay fotos. Valida un plan desde su detalle.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.validations.map((v) => {
                  const src = uploadPublicUrl(v.photo.publicUrl);
                  return (
                    <li
                      key={v.id}
                      className="overflow-hidden rounded-2xl border border-violet-100 bg-white/70 shadow-sm ring-1 ring-violet-50"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {src ? (
                          <Image src={src} alt="" fill className="object-cover" unoptimized sizes="(max-width:768px) 100vw, 33vw" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">Sin imagen</div>
                        )}
                      </div>
                      <div className="p-3 text-xs">
                        <div className="font-semibold text-slate-800">{v.plan.title}</div>
                        <div className="mt-0.5 text-slate-600">{v.plan.group.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              v.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : v.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {validationStatusLabel(v.status)}
                          </span>
                          <span className="text-slate-500">{formatWhen(v.submittedAtServer)}</span>
                        </div>
                        <Link href={`/app/plans/${v.plan.id}`} className="mt-2 inline-block font-semibold text-violet-700 hover:underline">
                          Ver plan
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-800">Movimientos de puntos</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {!data.pointsLedger.length ? (
                <li className="text-slate-600">Sin movimientos registrados.</li>
              ) : (
                data.pointsLedger.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2 ring-1 ring-violet-100/50"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{pointsReasonLabel(p.reason)}</div>
                      <div className="text-xs text-slate-500">
                        {p.group.name}
                        {p.plan ? ` · ${p.plan.title}` : ''} · {formatWhen(p.createdAt)}
                      </div>
                    </div>
                    <span className={`font-bold ${p.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {p.amount >= 0 ? '+' : ''}
                      {p.amount}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
