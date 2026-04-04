'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ConvosPartyGif } from '@/components/ConvosJoy';
import { useCelebration } from '@/components/CelebrationProvider';
import {
  absoluteUrlForApiPath,
  api,
  isAbortError,
  resolvePublicAssetUrl,
  type FeedItem,
  type GroupMemberRow,
  type GroupValidationPhotoRow,
  type PlanSuggestionRow,
  type PlanType,
} from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

const MAX_PLAN_GALLERY = 8;
const PLAN_GALLERY_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pdf,.heic,.heif';

type PlanGallerySlot = {
  key: string;
  file?: File;
  blob?: Blob;
  previewUrl: string;
};

function newPlanGalleryKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function planGalleryPdf(slot: PlanGallerySlot) {
  return slot.file?.type === 'application/pdf' || !!slot.file?.name?.toLowerCase().endsWith('.pdf');
}

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'food', label: 'Comida' },
  { value: 'date', label: 'Cita' },
  { value: 'hangout', label: 'Quedada' },
  { value: 'sport', label: 'Deporte' },
  { value: 'trip', label: 'Viaje' },
  { value: 'other', label: 'Otro' },
];

/** Sugerencias genéricas: el tipo de plan solo categoriza; no se enlaza al título. */
const PLAN_TITLE_HINTS = [
  'Cenita rica',
  'Café y charla',
  'Parque o paseo',
  'Noche de pelis',
  'Plan sorpresa',
  'Mini aventura',
  'Quedada tranqui',
  'Salida espontánea',
];

const PLACE_SUGGESTIONS: string[] = [
  'Parque',
  'Cafetería',
  'Cine',
  'Casa',
  'Centro comercial',
  'Mirador',
  'Restaurante',
  'Museo',
];

type QuickPreset = {
  id: string;
  label: string;
  emoji: string;
  title: string;
  venueHint: string;
  type: PlanType;
  hour: number;
  minute: number;
  addDays?: number;
  nextDow?: number;
};

const QUICK_PLAN_PRESETS: QuickPreset[] = [
  { id: 'cena-hoy', label: 'Cena hoy', emoji: '🍝', title: 'Cena juntos', venueHint: 'Restaurante', type: 'food', addDays: 0, hour: 20, minute: 0 },
  { id: 'cafe-manana', label: 'Café mañana', emoji: '☕', title: 'Café y charla', venueHint: 'Cafetería', type: 'food', addDays: 1, hour: 11, minute: 0 },
  { id: 'parque-sab', label: 'Parque sáb.', emoji: '🌳', title: 'Plan en el parque', venueHint: 'Parque', type: 'hangout', nextDow: 6, hour: 17, minute: 0 },
  { id: 'cita-noche', label: 'Cita noche', emoji: '💜', title: 'Noche juntos', venueHint: 'Cita', type: 'date', addDays: 1, hour: 19, minute: 30 },
];

function isoForQuickPreset(p: QuickPreset): string {
  const d = new Date();
  if (p.nextDow !== undefined) {
    const target = p.nextDow;
    const cur = d.getDay();
    const delta = (target - cur + 7) % 7;
    d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
  } else {
    d.setDate(d.getDate() + (p.addDays ?? 0));
  }
  d.setHours(p.hour, p.minute, 0, 0);
  return d.toISOString();
}

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

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatFeedLine(item: FeedItem): { title: string; sub?: string } {
  const actor = item.actor.name ?? item.actor.email.split('@')[0];
  const payload = item.payload ?? {};
  if (item.type === 'plan_validated') {
    const planTitle = item.plan?.title ?? (payload.title as string) ?? 'un plan';
    const venue =
      (payload.venueLabel as string | undefined) || (payload.placeName as string | undefined);
    return {
      title: `Validación en «${planTitle}»`,
      sub: `Validado por ${actor}${venue ? ` · ${venue}` : ''}`,
    };
  }
  if (item.type === 'mission_completed') {
    const t = typeof payload.title === 'string' ? payload.title : undefined;
    return { title: `${actor} completó una misión`, sub: t };
  }
  if (item.type === 'plan_created') {
    return { title: `${actor} creó un plan`, sub: item.plan?.title };
  }
  if (item.type === 'achievement') {
    return { title: `${actor} — logro`, sub: undefined };
  }
  return { title: `${actor} — ${item.type}`, sub: undefined };
}

function errMessage(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '';
}

export default function GroupDetailPage() {
  const router = useRouter();
  const celebrate = useCelebration();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [token, setToken] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof api.plans.listByGroup>> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof api.groups.leaderboard>> | null>(null);
  const [challenges, setChallenges] = useState<unknown[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [members, setMembers] = useState<GroupMemberRow[] | null>(null);
  const [validationPhotos, setValidationPhotos] = useState<GroupValidationPhotoRow[] | null>(null);
  const [suggestions, setSuggestions] = useState<PlanSuggestionRow[] | null>(null);
  const [backlogTitle, setBacklogTitle] = useState('');
  const [backlogType, setBacklogType] = useState<PlanType>('food');
  const [backlogNote, setBacklogNote] = useState('');
  const [backlogSaving, setBacklogSaving] = useState(false);
  const [schedulingSuggestionId, setSchedulingSuggestionId] = useState<string | null>(null);
  const [schLocal, setSchLocal] = useState('');
  const [schVenueLabel, setSchVenueLabel] = useState('');
  const [schedulingBusy, setSchedulingBusy] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<PlanSuggestionRow | null>(null);
  const [editSugTitle, setEditSugTitle] = useState('');
  const [editSugType, setEditSugType] = useState<PlanType>('food');
  const [editSugNote, setEditSugNote] = useState('');
  const [editSugSaving, setEditSugSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const planGalleryFileRef = useRef<HTMLInputElement>(null);
  const planGalleryVideoRef = useRef<HTMLVideoElement | null>(null);
  const planGalleryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const planGalleryStreamRef = useRef<MediaStream | null>(null);
  const [planGallerySlots, setPlanGallerySlots] = useState<PlanGallerySlot[]>([]);
  const [planGalleryCamReady, setPlanGalleryCamReady] = useState(false);
  const [planGalleryFacing, setPlanGalleryFacing] = useState<'environment' | 'user'>('environment');
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<PlanType>('food');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [venueLabel, setVenueLabel] = useState('');

  const defaultSchedule = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const canPlanGalleryCamera = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    [],
  );

  const planGallerySlotsRef = useRef(planGallerySlots);
  planGallerySlotsRef.current = planGallerySlots;

  useEffect(() => {
    return () => {
      planGallerySlotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      planGalleryStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!showPlanForm) {
      planGalleryStreamRef.current?.getTracks().forEach((t) => t.stop());
      planGalleryStreamRef.current = null;
      const v = planGalleryVideoRef.current;
      if (v) v.srcObject = null;
      setPlanGalleryCamReady(false);
      setPlanGallerySlots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return [];
      });
    }
  }, [showPlanForm]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const t = getAccessToken();
      if (!t) {
        router.replace('/auth/login');
        return;
      }
      setLoading(true);
      setToken(t);
      setError(null);
      try {
        const [g, pl, lb, ch, fd, mem, vph, sug] = await Promise.all([
          api.groups.get(t, groupId, signal),
          api.plans.listByGroup(t, groupId, signal),
          api.groups.leaderboard(t, groupId, undefined, signal).catch(() => []),
          api.groups.activeChallenges(t, groupId, signal).catch(() => []),
          api.groups.feed(t, groupId, { signal }).catch(() => []),
          api.groups.members(t, groupId, signal).catch(() => []),
          api.groups.validationPhotos(t, groupId, 30, signal).catch(() => []),
          api.planSuggestions.list(t, groupId, signal).catch(() => []),
        ]);
        setGroupName(g.name);
        setPlans(pl);
        setLeaderboard(lb);
        setChallenges(ch);
        setFeed(fd);
        setMembers(mem);
        setValidationPhotos(vph);
        setSuggestions(sug);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cargar el grupo';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [groupId, router],
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

  useEffect(() => {
    if (!scheduledLocal && defaultSchedule) setScheduledLocal(defaultSchedule);
  }, [defaultSchedule, scheduledLocal]);

  async function requestPlanGalleryCamera(preferredFacing?: 'environment' | 'user') {
    const want = preferredFacing ?? planGalleryFacing;
    setError(null);
    setPlanGalleryCamReady(false);
    planGalleryStreamRef.current?.getTracks().forEach((t) => t.stop());
    planGalleryStreamRef.current = null;
    const el = planGalleryVideoRef.current;
    if (el) el.srcObject = null;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: want } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      planGalleryStreamRef.current = stream;
      const video = planGalleryVideoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setPlanGalleryCamReady(true);
    } catch {
      setError('No se pudo acceder a la cámara para las fotos del plan.');
    }
  }

  function flipPlanGalleryCamera() {
    const next = planGalleryFacing === 'environment' ? 'user' : 'environment';
    setPlanGalleryFacing(next);
    void requestPlanGalleryCamera(next);
  }

  async function capturePlanGalleryPhoto() {
    setError(null);
    const video = planGalleryVideoRef.current;
    const canvas = planGalleryCanvasRef.current;
    if (!video || !canvas) return;
    if (!planGalleryStreamRef.current) {
      setError('Activa primero la cámara para añadir una foto al plan.');
      return;
    }
    if (planGallerySlots.length >= MAX_PLAN_GALLERY) {
      setError(`Máximo ${MAX_PLAN_GALLERY} fotos o archivos por plan.`);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('Espera un segundo a que la cámara cargue y vuelve a intentar.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError('No se pudo generar la imagen.');
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    setPlanGallerySlots((prev) => [...prev, { key: newPlanGalleryKey(), blob, previewUrl }]);
  }

  function onPlanGalleryFiles(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const list = e.target.files;
    if (!list?.length) return;
    setPlanGallerySlots((prev) => {
      const next = [...prev];
      for (let i = 0; i < list.length; i++) {
        if (next.length >= MAX_PLAN_GALLERY) {
          setError(`Solo se permiten hasta ${MAX_PLAN_GALLERY} archivos.`);
          break;
        }
        const file = list[i];
        next.push({ key: newPlanGalleryKey(), file, previewUrl: URL.createObjectURL(file) });
      }
      return next;
    });
    e.target.value = '';
  }

  function removePlanGallerySlot(key: string) {
    setPlanGallerySlots((prev) => {
      const item = prev.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !title.trim()) return;
    setSavingPlan(true);
    setError(null);
    try {
      const scheduledAt = new Date(scheduledLocal).toISOString();
      const photoIds: string[] = [];
      for (const slot of planGallerySlots) {
        const body = slot.file ?? slot.blob;
        if (!body) continue;
        const init = await api.plans.galleryInit(token, groupId);
        const fd = new FormData();
        const name =
          slot.file?.name || (body.type === 'image/png' ? 'foto.png' : 'foto.jpg');
        fd.append('file', body, name);
        const upRes = await fetch(absoluteUrlForApiPath(init.uploadUrl), {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!upRes.ok) throw new Error(await upRes.text());
        photoIds.push(init.photoId);
      }
      await api.plans.create(token, groupId, {
        title: title.trim(),
        type: planType,
        scheduledAt,
        venueLabel: venueLabel.trim() || undefined,
        ...(photoIds.length ? { photoIds } : {}),
      });
      setTitle('');
      setVenueLabel('');
      setShowPlanForm(false);
      await load();
      celebrate({
        title: '¡Plan creado!',
        message: 'Ya está en la lista del grupo. Cuando llegue el momento, validadlo con una foto.',
        emoji: '🎉',
      });
    } catch (e: unknown) {
      setError(errMessage(e) || 'Error al crear el plan');
    } finally {
      setSavingPlan(false);
    }
  }

  async function createQuickPlan(preset: QuickPreset) {
    if (!token) return;
    setQuickBusy(preset.id);
    setError(null);
    try {
      const scheduledAt = isoForQuickPreset(preset);
      await api.plans.create(token, groupId, {
        title: preset.title,
        type: preset.type,
        scheduledAt,
        venueLabel: preset.venueHint,
      });
      await load();
      celebrate({
        title: '¡Listo en un toque!',
        message: 'El plan ya tiene fecha. Lo verás abajo en la lista.',
        emoji: preset.emoji,
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'No se pudo crear el plan rápido';
      setError(msg);
    } finally {
      setQuickBusy(null);
    }
  }

  async function copyInvite() {
    if (!token) return;
    setInviteBusy(true);
    setInviteUrl(null);
    try {
      const inv = await api.groups.createInvite(token, groupId, { expiresInDays: 14 });
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${base}/app/join?token=${encodeURIComponent(inv.token)}`;
      setInviteUrl(url);
      await navigator.clipboard.writeText(url);
      celebrate({
        title: 'Enlace copiado',
        message: 'Compártelo por WhatsApp o donde quieras. Válido unos días.',
        emoji: '🔗',
        durationMs: 3800,
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Solo admins pueden crear enlaces';
      setError(msg);
    } finally {
      setInviteBusy(false);
    }
  }

  async function submitBacklog(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !backlogTitle.trim()) return;
    setBacklogSaving(true);
    setError(null);
    try {
      await api.planSuggestions.create(token, groupId, {
        title: backlogTitle.trim(),
        type: backlogType,
        note: backlogNote.trim() || undefined,
      });
      setBacklogTitle('');
      setBacklogNote('');
      await load();
      celebrate({
        title: 'Idea guardada',
        message: 'Cuando el grupo esté listo, agendad fecha y se convertirá en plan.',
        emoji: '💡',
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo guardar la idea';
      setError(msg);
    } finally {
      setBacklogSaving(false);
    }
  }

  function openSchedule(s: PlanSuggestionRow) {
    setSchedulingSuggestionId(s.id);
    setSchLocal(defaultSchedule);
    setSchVenueLabel('');
    setError(null);
  }

  async function submitScheduleForm(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !schedulingSuggestionId) return;
    setSchedulingBusy(true);
    setError(null);
    try {
      const out = await api.planSuggestions.schedule(token, groupId, schedulingSuggestionId, {
        scheduledAt: new Date(schLocal).toISOString(),
        venueLabel: schVenueLabel.trim() || undefined,
      });
      setSchedulingSuggestionId(null);
      await load();
      celebrate({
        title: '¡Plan agendado!',
        message: 'Te abrimos el detalle para que veas fecha, lugar y validación.',
        emoji: '📅',
        durationMs: 3200,
      });
      window.setTimeout(() => router.push(`/app/plans/${out.planId}`), 2600);
    } catch (e: unknown) {
      setError(errMessage(e) || 'No se pudo crear el plan');
    } finally {
      setSchedulingBusy(false);
    }
  }

  async function removeSuggestion(id: string) {
    if (!token || !window.confirm('¿Quitar esta idea de la lista?')) return;
    setError(null);
    try {
      await api.planSuggestions.remove(token, groupId, id);
      if (schedulingSuggestionId === id) setSchedulingSuggestionId(null);
      if (editingSuggestion?.id === id) setEditingSuggestion(null);
      await load();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo eliminar';
      setError(msg);
    }
  }

  function startEditSug(s: PlanSuggestionRow) {
    setEditingSuggestion(s);
    setEditSugTitle(s.title);
    setEditSugType(s.type);
    setEditSugNote(s.note ?? '');
  }

  async function saveEditSug(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editingSuggestion || !editSugTitle.trim()) return;
    setEditSugSaving(true);
    setError(null);
    try {
      await api.planSuggestions.update(token, groupId, editingSuggestion.id, {
        title: editSugTitle.trim(),
        type: editSugType,
        note: editSugNote.trim() || null,
      });
      setEditingSuggestion(null);
      await load();
      celebrate({
        title: 'Idea actualizada',
        message: 'Los cambios ya están visibles para todo el grupo.',
        emoji: '✏️',
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo guardar';
      setError(msg);
    } finally {
      setEditSugSaving(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm font-medium text-red-400/90 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            {loading ? '…' : groupName || 'Grupo'}
          </h1>
        </div>
        <button
          type="button"
          className="convos-btn-ghost px-4 py-2 text-sm"
          onClick={() => setShowPlanForm((v) => !v)}
        >
          {showPlanForm ? 'Ocultar formulario' : 'Plan a medida (fecha y título)'}
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="convos-card p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Planes del grupo</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Abajo están los que ya tienen fecha. Arriba, las ideas sin fecha hasta que las agendéis.
          </p>

          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/35 via-zinc-950/40 to-zinc-950/50 p-4 ring-1 ring-amber-500/15">
            <h3 className="text-sm font-bold text-amber-100">Planeados pero sin fecha</h3>
            <p className="mt-1 text-xs text-amber-200/90">
              Propuestas del grupo sin fecha. Cuando quieras llevarlas a cabo, agenda día y hora y se creará el plan.
            </p>
            {suggestions === null ? (
              <p className="mt-2 text-sm text-amber-300/80">Cargando…</p>
            ) : suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-amber-300/80">Aún no hay ideas. Añade la primera abajo.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-amber-500/20 bg-white/85 dark:bg-white/[0.06] px-3 py-2 text-sm shadow-sm ring-1 ring-white/10"
                  >
                    {editingSuggestion?.id === s.id ? (
                      <form className="grid gap-2" onSubmit={saveEditSug}>
                        <input
                          className="convos-input text-sm"
                          value={editSugTitle}
                          onChange={(e) => setEditSugTitle(e.target.value)}
                          required
                        />
                        <select
                          className="convos-input text-sm"
                          value={editSugType}
                          onChange={(e) => setEditSugType(e.target.value as PlanType)}
                        >
                          {PLAN_TYPES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="convos-input min-h-[60px] text-sm"
                          value={editSugNote}
                          onChange={(e) => setEditSugNote(e.target.value)}
                          placeholder="Nota opcional"
                          rows={2}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" className="convos-btn-primary h-9 px-4 text-xs" disabled={editSugSaving}>
                            {editSugSaving ? '…' : 'Guardar'}
                          </button>
                          <button type="button" className="convos-btn-ghost h-9 px-4 text-xs" onClick={() => setEditingSuggestion(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-900 dark:text-zinc-100">{s.title}</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-500">
                          {PLAN_TYPES.find((p) => p.value === s.type)?.label ?? s.type} · Propuesta de{' '}
                          {s.creator.name?.trim() || s.creator.email.split('@')[0]}
                        </div>
                        {s.note?.trim() ? <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">{s.note}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
                            onClick={() => openSchedule(s)}
                          >
                            Agendar con fecha
                          </button>
                          <button
                            type="button"
                            className="convos-btn-ghost px-3 py-1 text-xs"
                            onClick={() => startEditSug(s)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:underline"
                            onClick={() => void removeSuggestion(s.id)}
                          >
                            Quitar
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {schedulingSuggestionId ? (
              <form
                className="mt-4 grid gap-2 rounded-xl border border-slate-200 dark:border-white/12 bg-red-950/15 p-3"
                onSubmit={submitScheduleForm}
              >
                <div className="text-xs font-bold text-red-200">Agendar esta idea</div>
                <label className="convos-label text-xs">
                  <span>Fecha y hora</span>
                  <input
                    className="convos-input mt-0.5"
                    type="datetime-local"
                    value={schLocal}
                    onChange={(e) => setSchLocal(e.target.value)}
                    required
                  />
                </label>
                <p className="text-[11px] text-red-200/80">Opcional: un texto corto para recordar el sitio (café, casa de…).</p>
                <label className="convos-label text-xs">
                  <span>Lugar (opcional)</span>
                  <input
                    className="convos-input mt-0.5 min-h-[40px]"
                    value={schVenueLabel}
                    onChange={(e) => setSchVenueLabel(e.target.value)}
                    placeholder="Ej. Parque, casa de Ana…"
                    maxLength={200}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="convos-btn-primary h-10 min-h-[44px] px-4 text-xs disabled:opacity-60"
                    disabled={schedulingBusy}
                  >
                    {schedulingBusy ? 'Creando plan…' : 'Crear plan y abrir'}
                  </button>
                  <button type="button" className="convos-btn-ghost h-9 px-4 text-xs" onClick={() => setSchedulingSuggestionId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}
            <form className="mt-4 grid gap-2 border-t border-amber-500/20 pt-4" onSubmit={submitBacklog}>
              <div className="text-xs font-bold text-amber-100">Nueva idea</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="convos-label text-xs">
                  <span>Título</span>
                  <input
                    className="convos-input mt-0.5"
                    value={backlogTitle}
                    onChange={(e) => setBacklogTitle(e.target.value)}
                    placeholder="Ej. Ir al museo nuevo"
                    maxLength={200}
                    required
                  />
                </label>
                <label className="convos-label text-xs">
                  <span>Tipo (categoría)</span>
                  <select
                    className="convos-input mt-0.5"
                    value={backlogType}
                    onChange={(e) => setBacklogType(e.target.value as PlanType)}
                  >
                    {PLAN_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="convos-label text-xs">
                <span>Nota (opcional)</span>
                <textarea
                  className="convos-input mt-0.5 min-h-[52px]"
                  value={backlogNote}
                  onChange={(e) => setBacklogNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              </label>
              <button type="submit" className="convos-btn-primary h-9 w-fit px-4 text-xs" disabled={backlogSaving}>
                {backlogSaving ? 'Guardando…' : 'Añadir a la lista'}
              </button>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/40 via-zinc-950/50 to-black/40 p-4 ring-1 ring-white/10">
            <div className="flex flex-wrap items-start gap-3">
              <ConvosPartyGif className="hidden w-[140px] shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Plan en 1 toque</h3>
                  <span className="convos-wiggle text-lg" aria-hidden>
                    ⚡
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Crea un plan con fecha sugerida y una etiqueta de lugar opcional.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_PLAN_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!quickBusy || !token}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-white/[0.07] px-3 py-2 text-left text-sm font-semibold text-red-200 shadow-sm transition-all hover:border-red-400/35 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void createQuickPlan(p)}
                    >
                      <span className="text-lg" aria-hidden>
                        {p.emoji}
                      </span>
                      <span>{quickBusy === p.id ? 'Creando…' : p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {showPlanForm ? (
            <form className="mt-4 grid gap-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-red-950/20 p-4" onSubmit={submitPlan}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="convos-label">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">Título</span>
                  <input className="convos-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cena en…" required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">Tipo</span>
                  <select className="convos-input" value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
                    {PLAN_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-500">
                El tipo solo sirve para categorizar en rankings y filtros; no cambia el título automáticamente.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLAN_TITLE_HINTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-white/[0.07] px-3 py-1 text-xs font-semibold text-red-300 shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-white/12"
                    onClick={() => setTitle((prev) => (prev.trim() ? prev : s))}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-full border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-100 dark:hover:bg-white/12"
                  onClick={() => setTitle('')}
                >
                  Limpiar
                </button>
              </div>

              <label className="convos-label">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Fecha y hora</span>
                <input
                  className="convos-input"
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  required
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Hoy 20:00', addDays: 0, h: 20, m: 0 },
                  { label: 'Mañana 20:00', addDays: 1, h: 20, m: 0 },
                  { label: 'Sáb 19:00', nextDow: 6, h: 19, m: 0 },
                  { label: 'Dom 16:00', nextDow: 0, h: 16, m: 0 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="rounded-full border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-white/[0.07] px-3 py-1 text-xs font-semibold text-red-300 shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-white/12"
                    onClick={() => {
                      const d = new Date();
                      if ('addDays' in p) d.setDate(d.getDate() + (p.addDays ?? 0));
                      if ('nextDow' in p && typeof p.nextDow === 'number') {
                        const target = p.nextDow;
                        const cur = d.getDay();
                        const delta = (target - cur + 7) % 7;
                        d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
                      }
                      d.setHours(p.h, p.m, 0, 0);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      setScheduledLocal(local);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label className="convos-label">
                <span className="font-medium text-slate-700 dark:text-zinc-300">Lugar (opcional)</span>
                <input
                  className="convos-input min-h-[44px]"
                  value={venueLabel}
                  onChange={(e) => setVenueLabel(e.target.value)}
                  placeholder="Ej. Café Central, casa de…"
                  maxLength={200}
                />
              </label>
              <p className="text-xs text-slate-500 dark:text-zinc-500">Solo texto para el grupo; no guardamos coordenadas ni mapas.</p>

              <div className="flex flex-wrap gap-2">
                {PLACE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="min-h-[40px] rounded-full border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-100 dark:hover:bg-white/12"
                    onClick={() => setVenueLabel((prev) => (prev.trim() ? prev : s))}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/50 dark:bg-white/[0.03] p-4">
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">Fotos del plan (opcional)</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  Sube archivos o usa la cámara. Hasta {MAX_PLAN_GALLERY} entre fotos y PDF; el orden es el de la galería.
                </p>
                {canPlanGalleryCamera ? (
                  <div className="mt-3 grid gap-2">
                    <video
                      ref={planGalleryVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="aspect-video w-full max-w-md rounded-xl bg-slate-200 object-cover dark:bg-zinc-800"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="convos-btn-primary min-h-[44px] px-3 text-xs"
                        onClick={() => void requestPlanGalleryCamera()}
                      >
                        Activar cámara
                      </button>
                      <button
                        type="button"
                        className="convos-btn-ghost min-h-[44px] px-3 text-xs"
                        onClick={() => flipPlanGalleryCamera()}
                      >
                        Cambiar cámara
                      </button>
                      <button
                        type="button"
                        className="convos-btn-primary min-h-[44px] px-3 text-xs"
                        disabled={!planGalleryCamReady || savingPlan || planGallerySlots.length >= MAX_PLAN_GALLERY}
                        onClick={() => void capturePlanGalleryPhoto()}
                      >
                        Añadir foto
                      </button>
                    </div>
                  </div>
                ) : null}
                <input
                  ref={planGalleryFileRef}
                  type="file"
                  accept={PLAN_GALLERY_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={onPlanGalleryFiles}
                />
                <button
                  type="button"
                  className="convos-btn-ghost mt-3 h-11 w-full max-w-md text-sm"
                  disabled={savingPlan || planGallerySlots.length >= MAX_PLAN_GALLERY}
                  onClick={() => planGalleryFileRef.current?.click()}
                >
                  Adjuntar desde el dispositivo… ({planGallerySlots.length}/{MAX_PLAN_GALLERY})
                </button>
                {planGallerySlots.length ? (
                  <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {planGallerySlots.map((slot, idx) => (
                      <li
                        key={slot.key}
                        className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.06]"
                      >
                        <div className="relative aspect-video bg-slate-100 dark:bg-zinc-900">
                          {planGalleryPdf(slot) ? (
                            <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-zinc-400">
                              PDF
                            </div>
                          ) : (
                            <Image
                              src={slot.previewUrl}
                              alt=""
                              width={400}
                              height={225}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 p-1.5">
                          <span className="truncate text-[10px] text-slate-500 dark:text-zinc-500">{idx + 1}</span>
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-red-400"
                            disabled={savingPlan}
                            onClick={() => removePlanGallerySlot(slot.key)}
                          >
                            Quitar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <button
                type="submit"
                className="convos-btn-primary h-12 min-h-[48px] w-full sm:w-auto disabled:opacity-60"
                disabled={savingPlan}
              >
                {savingPlan ? 'Creando…' : 'Crear plan'}
              </button>
              <canvas ref={planGalleryCanvasRef} className="hidden" />
            </form>
          ) : null}

          <ul className="mt-4 grid gap-2">
            {!plans?.length ? (
              <li className="rounded-2xl border border-dashed border-slate-200 dark:border-white/12 bg-slate-50/90 dark:bg-white/[0.045] px-4 py-8 text-center text-sm text-slate-600 dark:text-zinc-400">
                <p className="font-medium text-slate-700 dark:text-zinc-300">Aún no hay planes en este grupo.</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                  Usa un preset rápido o «Plan a medida» para elegir fecha y, si quieres, un texto de lugar.
                </p>
              </li>
            ) : (
              plans.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/plans/${p.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] px-4 py-3 text-sm shadow-sm ring-1 ring-red-500/15 transition-all hover:bg-slate-100 dark:hover:bg-white/12 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    {p.galleryPhotos?.length ? (
                      <div className="flex shrink-0 gap-1 sm:order-first">
                        {p.galleryPhotos.slice(0, 4).map((g) => {
                          const src = resolvePublicAssetUrl(g.photo.publicUrl);
                          const pdf = g.photo.mimeType === 'application/pdf';
                          return (
                            <div
                              key={g.id}
                              className="h-14 w-14 overflow-hidden rounded-lg bg-slate-200 dark:bg-zinc-800 sm:h-16 sm:w-16"
                            >
                              {pdf && src ? (
                                <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-500">PDF</div>
                              ) : src ? (
                                // eslint-disable-next-line @next/next/no-img-element -- URL dinámica
                                <img src={src} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">{p.title}</div>
                      <div className="text-xs text-slate-500 dark:text-zinc-500">
                        {p.venueLabel?.trim() || 'Sin lugar'} · {formatWhen(p.scheduledAt)}
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === 'scheduled'
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : p.status === 'cancelled'
                            ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                            : 'bg-red-500/15 text-red-200'
                      }`}
                    >
                      {planStatusEs(p.status)}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Personas</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Quién forma parte de este grupo.</p>
            <ul className="mt-3 space-y-3">
              {members === null ? (
                <li className="text-sm text-slate-500 dark:text-zinc-500">Cargando…</li>
              ) : !members.length ? (
                <li className="text-sm text-slate-500 dark:text-zinc-500">No hay personas listadas.</li>
              ) : (
                members.map((m) => {
                  const src = resolvePublicAssetUrl(m.user.avatarUrl);
                  const label = m.user.name?.trim() || m.user.email.split('@')[0];
                  return (
                    <li key={m.userId} className="flex gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] p-2.5 ring-1 ring-white/10">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-red-500/10">
                        {src ? (
                          <Image src={src} alt="" fill className="object-cover" unoptimized sizes="44px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg text-red-400/50">👤</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-900 dark:text-zinc-100">{label}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-zinc-500">{m.user.email}</div>
                        {m.user.bio?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-zinc-400">{m.user.bio}</p>
                        ) : null}
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            m.role === 'admin' ? 'bg-red-500/25 text-red-100' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          {m.role === 'admin' ? 'Admin' : 'Miembro'}
                        </span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Invitar</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Genera un enlace (solo admins) y compártelo.</p>
            <button
              type="button"
              className="convos-btn-ghost mt-3 w-full text-sm"
              disabled={inviteBusy}
              onClick={() => void copyInvite()}
            >
              {inviteBusy ? 'Generando…' : 'Copiar enlace de invitación'}
            </button>
            {inviteUrl ? (
              <p className="mt-2 break-all rounded-xl bg-emerald-50 p-2 text-xs text-emerald-900">Copiado al portapapeles.</p>
            ) : null}
          </div>

          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Ranking (7 días)</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {!leaderboard?.length ? (
                <li className="text-slate-500 dark:text-zinc-500">Sin puntos aún esta semana.</li>
              ) : (
                leaderboard.slice(0, 8).map((row, i) => (
                  <li key={row.user.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700 dark:text-zinc-300">
                      <span className="mr-2 font-mono text-xs text-red-400">{i + 1}.</span>
                      {row.user.name ?? row.user.email}
                    </span>
                    <span className="font-semibold text-red-300">{row.weekPoints} pts</span>
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Retos activos</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-zinc-400">
              {!challenges?.length ? (
                <li>No hay retos visibles ahora.</li>
              ) : (
                challenges.map((row) => {
                  const r = row as {
                    id: string;
                    status: string;
                    progress?: { current?: number; target?: number };
                    challenge?: { title: string; description?: string | null };
                  };
                  const title = r.challenge?.title ?? 'Reto';
                  const cur = r.progress?.current ?? 0;
                  const tgt = r.progress?.target;
                  return (
                    <li key={r.id} className="rounded-xl bg-white/80 dark:bg-white/[0.05] px-3 py-2 ring-1 ring-white/10">
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{title}</div>
                      {tgt != null ? (
                        <div className="mt-1 text-xs text-red-400">
                          Progreso: {cur}/{tgt} · {r.status}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{r.status}</div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </aside>
      </div>

      <section className="convos-card p-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Fotos del grupo (validaciones)</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Las fotos que cada miembro envió al validar un plan. Puedes verlas aunque la hayas subido otra persona.
        </p>
        {validationPhotos === null ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">Cargando…</p>
        ) : !validationPhotos.length ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">Aún no hay fotos de validación en este grupo.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {validationPhotos.map((v) => {
              const src = resolvePublicAssetUrl(v.photo.publicUrl);
              const who = v.user.name?.trim() || v.user.email.split('@')[0];
              const isPdf = v.photo.mimeType === 'application/pdf';
              return (
                <li
                  key={v.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] shadow-sm ring-1 ring-white/5"
                >
                  <Link href={`/app/plans/${v.plan.id}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-slate-200 dark:bg-zinc-800">
                      {isPdf && src ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs font-semibold text-slate-600 dark:text-zinc-300">
                          <span className="text-2xl">📄</span>
                          PDF
                        </div>
                      ) : src ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URLs dinámicas (API / uploads)
                        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-zinc-500">Sin imagen</div>
                      )}
                    </div>
                    <div className="p-2 text-xs">
                      <div className="line-clamp-1 font-semibold text-slate-900 dark:text-zinc-100">{v.plan.title}</div>
                      <div className="text-slate-600 dark:text-zinc-400">Validado por {who}</div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-zinc-500">
                        {v.status === 'accepted' ? 'Aceptada' : v.status === 'rejected' ? 'Rechazada' : v.status === 'pending_review' ? 'En revisión' : v.status}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="convos-card p-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Timeline del grupo</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Validaciones y misiones recientes (solo para miembros).</p>
        <ul className="mt-4 space-y-3">
          {!feed?.length ? (
            <li className="rounded-2xl border border-dashed border-slate-200 dark:border-white/12 bg-slate-50/90 dark:bg-white/[0.045] px-4 py-8 text-center text-sm text-slate-600 dark:text-zinc-400">
              Aún no hay actividad en el feed. Cuando alguien valide un plan, aparecerá aquí.
            </li>
          ) : (
            feed.map((item) => {
              const line = formatFeedLine(item);
              return (
                <li key={item.id} className="rounded-2xl border border-slate-200/90 dark:border-white/80 bg-white/85 dark:bg-white/[0.06] px-4 py-3 text-sm shadow-sm ring-1 ring-white/10">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{line.title}</div>
                      {line.sub ? <div className="text-xs text-slate-500 dark:text-zinc-500">{line.sub}</div> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="text-xs text-slate-500 dark:text-zinc-500">{formatWhen(item.occurredAt)}</span>
                      {item.planId ? (
                        <Link href={`/app/plans/${item.planId}`} className="text-xs font-semibold text-red-400 hover:underline">
                          Ver plan
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
