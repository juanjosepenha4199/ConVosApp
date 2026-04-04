'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCelebration } from '@/components/CelebrationProvider';
import { api, isAbortError, resolvePublicAssetUrl, uploadPublicUrl, type ProfileActivityResponse } from '@/lib/api';
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
  const celebrate = useCelebration();
  const formRef = useRef<HTMLFormElement>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [data, setData] = useState<ProfileActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const baselineName = data?.user.name ?? '';
  const baselineBio = data?.user.bio ?? '';
  const isDirty = useMemo(
    () =>
      !!data &&
      (editName.trim() !== (baselineName || '').trim() || editBio.trim() !== (baselineBio || '').trim()),
    [data, editName, editBio, baselineName, baselineBio],
  );

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function onLeaveNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!isDirty) return;
    e.preventDefault();
    setPendingLeaveHref(href);
    setLeaveModalOpen(true);
  }

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const token = getAccessToken();
      if (!token) {
        router.replace('/auth/login');
        return;
      }
      setError(null);
      try {
        const act = await api.meActivity(token, signal);
        setData(act);
        setEditName(act.user.name ?? '');
        setEditBio(act.user.bio ?? '');
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cargar el perfil';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      const me = await fetchMeWithRefresh();
      if (cancelled) return;
      if (!me) {
        router.replace('/auth/login');
        return;
      }
      await load(ac.signal);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [load, router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSavingProfile(true);
    setError(null);
    try {
      const updated = await api.updateProfile(token, {
        name: editName.trim(),
        bio: editBio.trim(),
      });
      setData((prev) => (prev ? { ...prev, user: updated } : prev));
      celebrate({
        title: 'Perfil actualizado',
        message: 'Tu nombre y bio ya se ven así en el grupo.',
        emoji: '💜',
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo guardar';
      setError(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = getAccessToken();
    if (!token) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const updated = await api.uploadAvatar(token, file);
      setData((prev) => (prev ? { ...prev, user: updated } : prev));
      celebrate({
        title: '¡Nueva foto!',
        message: 'Tu avatar ya brilla en rankings y listas del grupo.',
        emoji: '📷',
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo subir la foto';
      setError(msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-5">
      {leaveModalOpen ? (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-900/40 dark:bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-profile-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 p-6 shadow-xl ring-1 ring-red-500/15">
            <h2 id="leave-profile-title" className="text-lg font-bold text-white">
              Cambios sin guardar
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              Tienes cambios sin guardar. ¿Seguro que quieres salir sin guardar?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="convos-btn-ghost h-11 w-full sm:w-auto"
                onClick={() => {
                  setLeaveModalOpen(false);
                  setPendingLeaveHref(null);
                  formRef.current?.querySelector('input')?.focus();
                }}
              >
                Quedarme y guardar
              </button>
              <button
                type="button"
                className="h-11 w-full rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100/90 dark:bg-white/10 px-5 text-sm font-semibold text-slate-800 dark:text-zinc-200 transition-colors hover:bg-slate-200/80 dark:hover:bg-white/15 sm:w-auto"
                onClick={() => {
                  const h = pendingLeaveHref;
                  setLeaveModalOpen(false);
                  setPendingLeaveHref(null);
                  if (h) router.push(h);
                }}
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/app"
            className="text-sm font-medium text-red-400/90 hover:underline"
            onClick={(e) => onLeaveNavClick(e, '/app')}
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Mi perfil
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="convos-card p-8 text-center text-sm text-slate-600 dark:text-zinc-400">Cargando…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : data ? (
        <>
          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Foto y datos</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              Tu foto y biografía los ven quienes comparten grupo contigo.
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-red-500/10 ring-2 ring-red-500/20 shadow-sm">
                {resolvePublicAssetUrl(data.user.avatarUrl) ? (
                  <Image
                    src={resolvePublicAssetUrl(data.user.avatarUrl)!}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="112px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl text-red-400/40">👤</div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <label className="block">
                  <span className="convos-label mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">Cambiar foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="block w-full max-w-xs text-sm text-slate-600 dark:text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-red-500/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-red-200 hover:file:bg-red-500/25"
                    disabled={uploadingAvatar}
                    onChange={(ev) => void onAvatarPick(ev)}
                  />
                </label>
                {uploadingAvatar ? <p className="text-xs text-red-400">Subiendo imagen…</p> : null}
              </div>
            </div>
            <form ref={formRef} className="mt-6 space-y-4 border-t border-slate-200/80 dark:border-white/10 pt-6" onSubmit={saveProfile}>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Nombre visible</span>
                <input
                  className="convos-input mt-1 min-h-[44px]"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={data.user.email}
                  maxLength={80}
                />
                <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-500">Así te verán en grupos y planes.</span>
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Biografía</span>
                <textarea
                  className="convos-input mt-1 min-h-[100px] resize-y"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Una línea sobre ti…"
                  maxLength={500}
                  rows={4}
                />
                <span className="mt-1 block text-right text-xs text-slate-500 dark:text-zinc-500">{editBio.length}/500</span>
              </label>
              <button type="submit" className="convos-btn-primary h-10 px-5 text-sm disabled:opacity-60" disabled={savingProfile}>
                {savingProfile ? 'Guardando…' : 'Guardar perfil'}
              </button>
            </form>
          </section>

          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Resumen</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div>
                <div className="text-slate-500 dark:text-zinc-500">Correo</div>
                <div className="font-semibold text-slate-900 dark:text-zinc-100">{data.user.email}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-zinc-500">Nivel</div>
                <div className="font-semibold text-red-300">{data.user.level}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-zinc-500">Puntos totales</div>
                <div className="font-semibold text-red-300">{data.user.totalPoints}</div>
              </div>
            </div>
          </section>

          <section className="convos-card p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Planes que validaste</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              Cada tarjeta es un plan donde validaste; si adjuntaste varios archivos, verás un acceso rápido a los demás.
            </p>
            {!data.validations.length ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">Aún no hay fotos. Valida un plan desde su detalle.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.validations.map((v) => {
                  const src = uploadPublicUrl(v.photo.publicUrl);
                  const extra = v.attachments?.length ?? 0;
                  const isPdf = v.photo.mimeType === 'application/pdf';
                  return (
                    <li
                      key={v.id}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] shadow-sm ring-1 ring-white/5"
                    >
                      <div className="relative aspect-video bg-slate-200 dark:bg-zinc-800">
                        {isPdf && src ? (
                          <a
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-full items-center justify-center text-sm font-semibold text-red-500 hover:underline"
                          >
                            Abrir PDF
                          </a>
                        ) : src ? (
                          <Image src={src} alt="" fill className="object-cover" unoptimized sizes="(max-width:768px) 100vw, 33vw" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-zinc-500">Sin imagen</div>
                        )}
                        {extra > 0 ? (
                          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                            +{extra} archivo{extra === 1 ? '' : 's'}
                          </div>
                        ) : null}
                      </div>
                      <div className="p-3 text-xs">
                        <div className="font-semibold text-slate-900 dark:text-zinc-100">{v.plan.title}</div>
                        <div className="mt-0.5 text-slate-600 dark:text-zinc-400">{v.plan.group.name}</div>
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
                          <span className="text-slate-500 dark:text-zinc-500">{formatWhen(v.submittedAtServer)}</span>
                        </div>
                        <Link href={`/app/plans/${v.plan.id}`} className="mt-2 inline-block font-semibold text-red-400 hover:underline">
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
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Movimientos de puntos</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {!data.pointsLedger.length ? (
                <li className="text-slate-600 dark:text-zinc-400">Sin movimientos registrados.</li>
              ) : (
                data.pointsLedger.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-white/80 bg-white/80 dark:bg-white/[0.05] px-3 py-2 ring-1 ring-white/10"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{pointsReasonLabel(p.reason)}</div>
                      <div className="text-xs text-slate-500 dark:text-zinc-500">
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
