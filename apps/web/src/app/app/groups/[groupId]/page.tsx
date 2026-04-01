'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConvosPartyGif } from '@/components/ConvosJoy';
import { api, type FeedItem, type PlanType } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'food', label: 'Comida' },
  { value: 'date', label: 'Cita' },
  { value: 'hangout', label: 'Quedada' },
  { value: 'sport', label: 'Deporte' },
  { value: 'trip', label: 'Viaje' },
  { value: 'other', label: 'Otro' },
];

const TITLE_SUGGESTIONS: Record<PlanType, string[]> = {
  food: ['Cenita rica', 'Brunch', 'Helado + charla', 'Comida sorpresa'],
  date: ['Cita tranquila', 'Noche de peli', 'Atardecer juntos', 'Café + paseo'],
  hangout: ['Plan tranqui', 'Salir a hablar', 'Tarde de juegos', 'Desconexión'],
  sport: ['Caminata', 'Gym juntos', 'Bici', 'Partidito'],
  trip: ['Plan de domingo', 'Escapadita', 'Mirador', 'Picnic'],
  other: ['Plan especial', 'Momento lindo', 'Algo espontáneo', 'Mini aventura'],
};

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

const LAST_COORDS_KEY = 'convos.lastPlanCoords';

type QuickPreset = {
  id: string;
  label: string;
  emoji: string;
  title: string;
  placeName: string;
  type: PlanType;
  hour: number;
  minute: number;
  addDays?: number;
  nextDow?: number;
};

const QUICK_PLAN_PRESETS: QuickPreset[] = [
  { id: 'cena-hoy', label: 'Cena hoy', emoji: '🍝', title: 'Cena juntos', placeName: 'Restaurante', type: 'food', addDays: 0, hour: 20, minute: 0 },
  { id: 'cafe-manana', label: 'Café mañana', emoji: '☕', title: 'Café y charla', placeName: 'Cafetería', type: 'food', addDays: 1, hour: 11, minute: 0 },
  { id: 'parque-sab', label: 'Parque sáb.', emoji: '🌳', title: 'Plan en el parque', placeName: 'Parque', type: 'hangout', nextDow: 6, hour: 17, minute: 0 },
  { id: 'cita-noche', label: 'Cita noche', emoji: '💜', title: 'Noche juntos', placeName: 'Cita', type: 'date', addDays: 1, hour: 19, minute: 30 },
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

function readCachedCoords(): { lat: string; lng: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_COORDS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { lat?: string; lng?: string; t?: number };
    if (!o.lat || !o.lng) return null;
    if (typeof o.t === 'number' && Date.now() - o.t > 7 * 24 * 60 * 60 * 1000) return null;
    return { lat: o.lat, lng: o.lng };
  } catch {
    return null;
  }
}

function writeCachedCoords(lat: string, lng: string) {
  try {
    localStorage.setItem(LAST_COORDS_KEY, JSON.stringify({ lat, lng, t: Date.now() }));
  } catch {
    /* ignore */
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
    const placeName = payload.placeName as string | undefined;
    return { title: `${actor} validó «${planTitle}»`, sub: placeName };
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

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [token, setToken] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof api.plans.listByGroup>> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof api.groups.leaderboard>> | null>(null);
  const [challenges, setChallenges] = useState<unknown[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<PlanType>('food');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusM, setRadiusM] = useState('250');

  const defaultSchedule = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const load = useCallback(async () => {
    const t = getAccessToken();
    if (!t) {
      router.replace('/auth/login');
      return;
    }
    setToken(t);
    setError(null);
    try {
      const g = await api.groups.get(t, groupId);
      setGroupName(g.name);
      const [pl, lb, ch, fd] = await Promise.all([
        api.plans.listByGroup(t, groupId),
        api.groups.leaderboard(t, groupId).catch(() => []),
        api.groups.activeChallenges(t, groupId).catch(() => []),
        api.groups.feed(t, groupId).catch(() => []),
      ]);
      setPlans(pl);
      setLeaderboard(lb);
      setChallenges(ch);
      setFeed(fd);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cargar el grupo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

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

  useEffect(() => {
    if (!scheduledLocal && defaultSchedule) setScheduledLocal(defaultSchedule);
  }, [defaultSchedule, scheduledLocal]);

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || !placeName.trim() || !lat.trim() || !lng.trim()) return;
    setSavingPlan(true);
    setError(null);
    try {
      const scheduledAt = new Date(scheduledLocal).toISOString();
      await api.plans.create(token, groupId, {
        title: title.trim(),
        type: planType,
        scheduledAt,
        place: {
          name: placeName.trim(),
          address: placeAddress.trim() || placeName.trim(),
          lat: lat.trim(),
          lng: lng.trim(),
        },
        locationRadiusM: Math.min(5000, Math.max(50, Number(radiusM) || 250)),
      });
      setTitle('');
      setShowPlanForm(false);
      await load();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al crear el plan';
      setError(msg);
    } finally {
      setSavingPlan(false);
    }
  }

  async function fillMyLocation() {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });
      const la = String(pos.coords.latitude);
      const ln = String(pos.coords.longitude);
      setLat(la);
      setLng(ln);
      writeCachedCoords(la, ln);
    } catch {
      setError('No se pudo obtener tu ubicación. Activa permisos/GPS e inténtalo de nuevo.');
    }
  }

  async function createQuickPlan(preset: QuickPreset) {
    if (!token) return;
    setQuickBusy(preset.id);
    setError(null);
    try {
      let la: string;
      let ln: string;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 14000,
            maximumAge: 90000,
          });
        });
        la = String(pos.coords.latitude);
        ln = String(pos.coords.longitude);
        writeCachedCoords(la, ln);
      } catch {
        const c = readCachedCoords();
        if (!c) {
          setError('Para el plan rápido necesitamos ubicación una vez, o usa «Personalizar plan».');
          return;
        }
        la = c.lat;
        ln = c.lng;
      }
      const scheduledAt = isoForQuickPreset(preset);
      await api.plans.create(token, groupId, {
        title: preset.title,
        type: preset.type,
        scheduledAt,
        place: {
          name: preset.placeName,
          address: preset.placeName,
          lat: la,
          lng: ln,
        },
        locationRadiusM: 400,
      });
      setLat(la);
      setLng(ln);
      await load();
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
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Solo admins pueden crear enlaces';
      setError(msg);
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm font-medium text-violet-600/90 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 bg-gradient-to-r from-violet-700 to-cyan-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            {loading ? '…' : groupName || 'Grupo'}
          </h1>
        </div>
        <button type="button" className="convos-btn-ghost px-4 py-2 text-sm" onClick={() => setShowPlanForm((v) => !v)}>
          {showPlanForm ? 'Cerrar formulario' : 'Personalizar plan'}
        </button>
      </header>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="convos-card p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800">Planes</h2>
          <p className="mt-1 text-sm text-slate-600">Toca un plan para ver detalle y validar con foto + GPS.</p>

          <div className="mt-4 rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/90 via-white/60 to-violet-50/80 p-4 ring-1 ring-white/70">
            <div className="flex flex-wrap items-start gap-3">
              <ConvosPartyGif className="hidden w-[140px] shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">Plan en 1 toque</h3>
                  <span className="convos-wiggle text-lg" aria-hidden>
                    ⚡
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Un solo toque crea el plan. La primera vez pide ubicación; después reutiliza coordenadas guardadas solo en
                  este dispositivo (7 días).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_PLAN_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!quickBusy || !token}
                      className="inline-flex items-center gap-2 rounded-2xl border border-violet-200/90 bg-white/90 px-3 py-2 text-left text-sm font-semibold text-violet-900 shadow-sm transition-all hover:border-fuchsia-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
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
            <form className="mt-4 grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4" onSubmit={submitPlan}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Título</span>
                  <input className="convos-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cena en…" required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Tipo</span>
                  <select className="convos-input" value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
                    {PLAN_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {TITLE_SUGGESTIONS[planType].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-violet-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-violet-800 shadow-sm transition-all hover:bg-white"
                    onClick={() => setTitle((prev) => (prev.trim() ? prev : s))}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700 transition-all hover:bg-white"
                  onClick={() => setTitle('')}
                >
                  Limpiar
                </button>
              </div>

              <label className="convos-label">
                <span className="font-medium text-slate-700">Fecha y hora</span>
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
                    className="rounded-full border border-violet-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-violet-800 shadow-sm transition-all hover:bg-white"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lugar (nombre)</span>
                  <input className="convos-input" value={placeName} onChange={(e) => setPlaceName(e.target.value)} required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Dirección</span>
                  <input className="convos-input" value={placeAddress} onChange={(e) => setPlaceAddress(e.target.value)} />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {PLACE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700 transition-all hover:bg-white"
                    onClick={() => setPlaceName((prev) => (prev.trim() ? prev : s))}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lat</span>
                  <input className="convos-input font-mono" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="6.2442" required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Lng</span>
                  <input className="convos-input font-mono" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-75.5812" required />
                </label>
                <label className="convos-label">
                  <span className="font-medium text-slate-700">Radio (m)</span>
                  <input className="convos-input" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} inputMode="numeric" />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="convos-btn-ghost h-10 px-4 text-xs"
                  onClick={() => void fillMyLocation()}
                >
                  Usar mi ubicación (lat/lng)
                </button>
                {['150', '250', '400', '800'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="rounded-full border border-violet-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-violet-800 shadow-sm transition-all hover:bg-white"
                    onClick={() => setRadiusM(r)}
                  >
                    Radio {r}m
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                La validación GPS usa este radio respecto al lugar. Las coordenadas deben coincidir con el sitio real.
              </p>
              <button type="submit" className="convos-btn-primary h-11 w-full sm:w-auto disabled:opacity-60" disabled={savingPlan}>
                {savingPlan ? 'Guardando…' : 'Crear plan'}
              </button>
            </form>
          ) : null}

          <ul className="mt-4 grid gap-2">
            {!plans?.length ? (
              <li className="rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-8 text-center text-sm text-slate-600">
                No hay planes. Usa «Plan en 1 toque» arriba o «Personalizar plan».
              </li>
            ) : (
              plans.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/plans/${p.id}`}
                    className="flex flex-col gap-1 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-sm ring-1 ring-violet-100/60 transition-all hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{p.title}</div>
                      <div className="text-xs text-slate-500">{p.place?.name ?? 'Lugar'} · {formatWhen(p.scheduledAt)}</div>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === 'scheduled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'cancelled'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-800">Invitar</h2>
            <p className="mt-1 text-xs text-slate-600">Genera un enlace (solo admins) y compártelo.</p>
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
            <h2 className="text-sm font-bold text-slate-800">Ranking (7 días)</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {!leaderboard?.length ? (
                <li className="text-slate-500">Sin puntos aún esta semana.</li>
              ) : (
                leaderboard.slice(0, 8).map((row, i) => (
                  <li key={row.user.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">
                      <span className="mr-2 font-mono text-xs text-violet-600">{i + 1}.</span>
                      {row.user.name ?? row.user.email}
                    </span>
                    <span className="font-semibold text-violet-800">{row.weekPoints} pts</span>
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="convos-card p-5">
            <h2 className="text-sm font-bold text-slate-800">Retos activos</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
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
                    <li key={r.id} className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-violet-100/50">
                      <div className="font-medium text-slate-800">{title}</div>
                      {tgt != null ? (
                        <div className="mt-1 text-xs text-violet-700">
                          Progreso: {cur}/{tgt} · {r.status}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500">{r.status}</div>
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
        <h2 className="text-sm font-bold text-slate-800">Timeline del grupo</h2>
        <p className="mt-1 text-sm text-slate-600">Validaciones y misiones recientes (solo para miembros).</p>
        <ul className="mt-4 space-y-3">
          {!feed?.length ? (
            <li className="rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-8 text-center text-sm text-slate-600">
              Aún no hay actividad en el feed. Cuando alguien valide un plan, aparecerá aquí.
            </li>
          ) : (
            feed.map((item) => {
              const line = formatFeedLine(item);
              return (
                <li key={item.id} className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-sm ring-1 ring-violet-100/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-slate-800">{line.title}</div>
                      {line.sub ? <div className="text-xs text-slate-500">{line.sub}</div> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="text-xs text-slate-400">{formatWhen(item.occurredAt)}</span>
                      {item.planId ? (
                        <Link href={`/app/plans/${item.planId}`} className="text-xs font-semibold text-violet-700 hover:underline">
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
