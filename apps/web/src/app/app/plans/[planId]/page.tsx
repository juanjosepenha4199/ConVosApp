'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCelebration } from '@/components/CelebrationProvider';
import {
  api,
  isAbortError,
  resolvePublicAssetUrl,
  type PlanDetail,
  type PlanType,
  type PlanValidationMemberView,
} from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

function planStatusEs(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Programado';
    case 'cancelled':
      return 'Cancelado';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
}

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'food', label: 'Comida' },
  { value: 'date', label: 'Cita' },
  { value: 'hangout', label: 'Quedada' },
  { value: 'sport', label: 'Deporte' },
  { value: 'trip', label: 'Viaje' },
  { value: 'other', label: 'Otro' },
];

function isPdfMime(m: string | null | undefined) {
  return m === 'application/pdf';
}

function validationMediaList(v: PlanValidationMemberView) {
  const main = v.photo?.publicUrl ? [v.photo] : [];
  const extra = (v.attachments ?? []).map((a) => a.photo).filter((p) => p?.publicUrl);
  return [...main, ...extra];
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlanDetailPage() {
  const celebrate = useCelebration();
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<PlanType>('food');
  const [editScheduledLocal, setEditScheduledLocal] = useState('');
  const [editVenueLabel, setEditVenueLabel] = useState('');
  const [editRequiresAll, setEditRequiresAll] = useState(false);

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
      const token = getAccessToken();
      if (!token) return;
      try {
        const p = await api.plans.get(token, planId, ac.signal);
        if (!cancelled) setPlan(p);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Plan no encontrado';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [planId, router]);

  useEffect(() => {
    if (!plan || showEdit) return;
    setEditTitle(plan.title);
    setEditType(plan.type);
    setEditScheduledLocal(toDatetimeLocalValue(plan.scheduledAt));
    setEditVenueLabel(plan.venueLabel ?? '');
    setEditRequiresAll(!!plan.requiresAllConfirm);
  }, [plan, showEdit]);

  async function cancelPlan() {
    if (!plan || plan.status !== 'scheduled') return;
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm('¿Cancelar este plan?')) return;
    setCancelling(true);
    setError(null);
    try {
      await api.plans.cancel(token, planId);
      const p = await api.plans.get(token, planId);
      setPlan(p);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cancelar';
      setError(msg);
    } finally {
      setCancelling(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !plan) return;
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await api.plans.update(token, planId, {
        title: editTitle.trim(),
        type: editType,
        scheduledAt: new Date(editScheduledLocal).toISOString(),
        venueLabel: editVenueLabel.trim() || null,
        requiresAllConfirm: editRequiresAll,
      });
      setPlan(updated);
      setShowEdit(false);
      celebrate({
        title: 'Cambios guardados',
        message: 'El plan ya está actualizado para todo el grupo.',
        emoji: '✅',
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'No se pudo guardar';
      setError(msg);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
      <header>
        <Link href={plan ? `/app/groups/${plan.groupId}` : '/app'} className="text-sm font-medium text-red-400/90 hover:underline">
          ← Volver al grupo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{loading ? '…' : plan?.title ?? 'Plan'}</h1>
      </header>

      {plan?.galleryPhotos?.length ? (
        <div className="convos-card overflow-hidden p-0">
          <div className="border-b border-slate-200/80 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500 dark:border-white/10">
            Fotos del plan
          </div>
          <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:grid-cols-4">
            {plan.galleryPhotos.map((row) => {
              const src = resolvePublicAssetUrl(row.photo.publicUrl);
              const pdf = isPdfMime(row.photo.mimeType ?? null);
              return (
                <div key={row.id} className="min-w-0">
                  {pdf && src ? (
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-red-500 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      Ver PDF
                    </a>
                  ) : src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL dinámica
                    <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {plan ? (
        <>
          <div className="convos-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600 dark:text-zinc-400">{formatWhen(plan.scheduledAt)}</p>
                {plan.venueLabel?.trim() ? (
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-zinc-100">{plan.venueLabel}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                  Tipo: <span className="font-semibold text-slate-700 dark:text-zinc-300">{plan.type}</span>
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.status === 'scheduled' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                }`}
              >
                {planStatusEs(plan.status)}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {plan.status === 'scheduled' ? (
                <Link href={`/app/plans/${plan.id}/validate`} className="convos-btn-primary h-12 flex-1 text-center text-base leading-[2.75rem]">
                  Validar plan (foto)
                </Link>
              ) : (
                <p className="text-sm text-slate-600 dark:text-zinc-400">Este plan ya no admite validación.</p>
              )}
              {plan.canEdit ? (
                <button
                  type="button"
                  className="convos-btn-ghost h-12 px-6 text-sm"
                  onClick={() => setShowEdit((v) => !v)}
                >
                  {showEdit ? 'Cerrar edición' : 'Editar plan'}
                </button>
              ) : null}
              {plan.status === 'scheduled' && plan.canEdit ? (
                <button
                  type="button"
                  className="convos-btn-ghost h-12 px-6 text-sm text-red-200 ring-1 ring-red-500/30 hover:border-red-500/40 hover:bg-red-500/10"
                  disabled={cancelling}
                  onClick={() => void cancelPlan()}
                >
                  {cancelling ? '…' : 'Cancelar plan'}
                </button>
              ) : null}
            </div>
          </div>

          {showEdit && plan.canEdit ? (
            <form className="convos-card space-y-4 p-6" onSubmit={saveEdit}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Editar plan</h2>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Título</span>
                <input className="convos-input mt-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Tipo (categoría)</span>
                <select className="convos-input mt-1" value={editType} onChange={(e) => setEditType(e.target.value as PlanType)}>
                  {PLAN_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Fecha y hora</span>
                <input
                  className="convos-input mt-1"
                  type="datetime-local"
                  value={editScheduledLocal}
                  onChange={(e) => setEditScheduledLocal(e.target.value)}
                  required
                />
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Lugar (opcional)</span>
                <input
                  className="convos-input mt-1"
                  value={editVenueLabel}
                  onChange={(e) => setEditVenueLabel(e.target.value)}
                  maxLength={200}
                  placeholder="Texto libre para el grupo"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                <input type="checkbox" checked={editRequiresAll} onChange={(e) => setEditRequiresAll(e.target.checked)} />
                Requiere que todos confirmen con validación
              </label>
              <button type="submit" className="convos-btn-primary h-11 disabled:opacity-60" disabled={savingEdit}>
                {savingEdit ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          ) : null}
        </>
      ) : !loading ? (
        <p className="text-sm text-slate-600 dark:text-zinc-400">No se encontró el plan.</p>
      ) : null}

      {plan?.validations?.length ? (
        <section className="convos-card p-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Fotos y archivos de validación</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Todas las personas del grupo pueden ver lo que cada quien envió al validar este plan (fotos y PDF).
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {plan.validations.map((v) => {
              const media = validationMediaList(v);
              const who = v.user.name?.trim() || v.user.email.split('@')[0];
              const statusLabel =
                v.status === 'accepted'
                  ? 'Aceptada'
                  : v.status === 'rejected'
                    ? 'Rechazada'
                    : v.status === 'pending_review'
                      ? 'En revisión'
                      : v.status;
              return (
                <li
                  key={v.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] shadow-sm ring-1 ring-white/5"
                >
                  <div className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-3">
                    {media.length ? (
                      media.map((p) => {
                        const src = resolvePublicAssetUrl(p.publicUrl);
                        const pdf = isPdfMime(p.mimeType ?? null);
                        return pdf && src ? (
                          <a
                            key={p.id}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-red-500 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                          >
                            Ver PDF
                          </a>
                        ) : src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URLs dinámicas (API / uploads)
                          <img
                            key={p.id}
                            src={src}
                            alt=""
                            className="aspect-video w-full rounded-xl object-cover"
                          />
                        ) : null;
                      })
                    ) : (
                      <div className="col-span-full flex aspect-video items-center justify-center bg-slate-200 text-xs text-slate-500 dark:bg-zinc-800 dark:text-zinc-500">
                        Sin archivos
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-sm">
                    <p className="text-sm font-semibold text-red-200">Validado por {who}</p>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">{formatWhen(v.submittedAtServer)}</div>
                    <span className="mt-1 inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                      {statusLabel}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
