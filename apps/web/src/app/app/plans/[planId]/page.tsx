'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, isAbortError, resolvePublicAssetUrl, type PlanDetail, type PlanType } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'food', label: 'Comida' },
  { value: 'date', label: 'Cita' },
  { value: 'hangout', label: 'Quedada' },
  { value: 'sport', label: 'Deporte' },
  { value: 'trip', label: 'Viaje' },
  { value: 'other', label: 'Otro' },
];

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
  const [editPlaceName, setEditPlaceName] = useState('');
  const [editPlaceAddress, setEditPlaceAddress] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadiusM, setEditRadiusM] = useState('250');
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
    setEditPlaceName(plan.place?.name ?? '');
    setEditPlaceAddress(plan.place?.address ?? '');
    setEditLat(plan.place?.lat ?? '');
    setEditLng(plan.place?.lng ?? '');
    setEditRadiusM(String(plan.locationRadiusM ?? 250));
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
    if (!editTitle.trim() || !editPlaceName.trim() || !editLat.trim() || !editLng.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await api.plans.update(token, planId, {
        title: editTitle.trim(),
        type: editType,
        scheduledAt: new Date(editScheduledLocal).toISOString(),
        place: {
          name: editPlaceName.trim(),
          address: editPlaceAddress.trim() || editPlaceName.trim(),
          lat: editLat.trim(),
          lng: editLng.trim(),
        },
        locationRadiusM: Math.min(5000, Math.max(50, Number(editRadiusM) || 250)),
        requiresAllConfirm: editRequiresAll,
      });
      setPlan(updated);
      setShowEdit(false);
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
        <Link href={plan ? `/app/groups/${plan.groupId}` : '/app'} className="text-sm font-medium text-violet-600/90 hover:underline">
          ← Volver al grupo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{loading ? '…' : plan?.title ?? 'Plan'}</h1>
      </header>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {plan ? (
        <>
          <div className="convos-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600">{formatWhen(plan.scheduledAt)}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{plan.place?.name}</p>
                <p className="text-sm text-slate-600">{plan.place?.address}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Tipo: <span className="font-semibold text-slate-700">{plan.type}</span>
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.status === 'scheduled' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {plan.status}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {plan.status === 'scheduled' ? (
                <Link href={`/app/plans/${plan.id}/validate`} className="convos-btn-primary h-12 flex-1 text-center text-base leading-[2.75rem]">
                  Validar plan (foto + GPS)
                </Link>
              ) : (
                <p className="text-sm text-slate-600">Este plan ya no admite validación.</p>
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
                  className="convos-btn-ghost h-12 px-6 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-50"
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
              <h2 className="text-sm font-bold text-slate-800">Editar plan</h2>
              <label className="convos-label block">
                <span className="font-medium text-slate-700">Título</span>
                <input className="convos-input mt-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700">Tipo (categoría)</span>
                <select className="convos-input mt-1" value={editType} onChange={(e) => setEditType(e.target.value as PlanType)}>
                  {PLAN_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="convos-label block">
                <span className="font-medium text-slate-700">Fecha y hora</span>
                <input
                  className="convos-input mt-1"
                  type="datetime-local"
                  value={editScheduledLocal}
                  onChange={(e) => setEditScheduledLocal(e.target.value)}
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lugar (nombre)</span>
                  <input className="convos-input mt-1" value={editPlaceName} onChange={(e) => setEditPlaceName(e.target.value)} required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Dirección</span>
                  <input className="convos-input mt-1" value={editPlaceAddress} onChange={(e) => setEditPlaceAddress(e.target.value)} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lat</span>
                  <input className="convos-input mt-1 font-mono" value={editLat} onChange={(e) => setEditLat(e.target.value)} required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lng</span>
                  <input className="convos-input mt-1 font-mono" value={editLng} onChange={(e) => setEditLng(e.target.value)} required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Radio (m)</span>
                  <input className="convos-input mt-1" value={editRadiusM} onChange={(e) => setEditRadiusM(e.target.value)} inputMode="numeric" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
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
        <p className="text-sm text-slate-600">No se encontró el plan.</p>
      ) : null}

      {plan?.validations?.length ? (
        <section className="convos-card p-6">
          <h2 className="text-sm font-bold text-slate-800">Fotos de validación</h2>
          <p className="mt-1 text-sm text-slate-600">
            Todas las personas del grupo pueden ver las fotos que cada quien envió al validar este plan.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {plan.validations.map((v) => {
              const src = resolvePublicAssetUrl(v.photo?.publicUrl ?? null);
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
                  className="overflow-hidden rounded-2xl border border-violet-100 bg-white/70 shadow-sm ring-1 ring-violet-50"
                >
                  <div className="relative aspect-video bg-slate-100">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width:768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-3 text-sm">
                    <p className="text-sm font-semibold text-violet-900">Validado por {who}</p>
                    <div className="mt-0.5 text-xs text-slate-500">{formatWhen(v.submittedAtServer)}</div>
                    <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800">
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
