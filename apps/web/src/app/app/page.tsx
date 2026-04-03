'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConvosJoy } from '@/components/ConvosJoy';
import { fetchMeWithRefresh, clearTokens, getAccessToken } from '@/lib/auth';
import { api, isAbortError, type ArenaLeaderboardRow, type ArenaMyRow, type GroupType } from '@/lib/api';

const GROUP_TYPES: { value: GroupType; label: string }[] = [
  { value: 'friends', label: 'Amigos' },
  { value: 'couple', label: 'Pareja' },
  { value: 'family', label: 'Familia' },
  { value: 'other', label: 'Otro' },
];

function tierLabel(t: string) {
  switch (t) {
    case 'legend':
      return 'Leyenda';
    case 'master':
      return 'Maestro';
    case 'gold':
      return 'Oro';
    case 'silver':
      return 'Plata';
    default:
      return 'Bronce';
  }
}

export default function DashboardPage() {
  const [me, setMe] = useState<Awaited<ReturnType<typeof fetchMeWithRefresh>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof api.groups.list>> | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GroupType>('friends');
  const [arenaType, setArenaType] = useState<GroupType>('friends');
  const [arena, setArena] = useState<ArenaLeaderboardRow[] | null>(null);
  const [arenaMe, setArenaMe] = useState<ArenaMyRow[] | null>(null);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [arenaError, setArenaError] = useState<string | null>(null);

  const sessionReady = useRef(false);

  const loadGroups = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setGroups(null);
      return;
    }
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const list = await api.groups.list(token);
      setGroups(list);
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al cargar grupos';
      setGroupsError(msg);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      try {
        if (!sessionReady.current) {
          const user = await fetchMeWithRefresh();
          if (cancelled) return;
          setMe(user);
          setLoading(false);
          if (!user) return;
          sessionReady.current = true;

          const token = getAccessToken();
          if (!token) return;

          setGroupsLoading(true);
          setGroupsError(null);
          try {
            const list = await api.groups.list(token, signal);
            if (!cancelled) setGroups(list);
          } catch (e: unknown) {
            if (isAbortError(e)) return;
            const msg =
              e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al cargar grupos';
            if (!cancelled) setGroupsError(msg);
          } finally {
            if (!cancelled) setGroupsLoading(false);
          }
        }

        const token = getAccessToken();
        if (!token) return;

        setArenaLoading(true);
        setArenaError(null);
        try {
          const [lb, mine] = await Promise.all([
            api.arena.leaderboard(token, { type: arenaType, range: '7d', limit: 10, signal }),
            api.arena.me(token, { type: arenaType, range: '7d', signal }),
          ]);
          if (!cancelled) {
            setArena(lb);
            setArenaMe(mine);
          }
        } catch (e: unknown) {
          if (isAbortError(e)) return;
          if (!cancelled) {
            setArenaError(
              e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al cargar arena',
            );
          }
        } finally {
          if (!cancelled) setArenaLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [arenaType]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setGroupsError(null);
    try {
      await api.groups.create(token, { name: newName.trim(), type: newType });
      setNewName('');
      await loadGroups();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo crear el grupo';
      setGroupsError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-violet-600/90">Dashboard</div>
          <div className="bg-gradient-to-r from-violet-700 to-cyan-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            ConVos
          </div>
          <ConvosJoy className="mt-2 justify-start" size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/profile"
            className="convos-btn-primary px-5 py-2 text-sm"
          >
            Mi perfil
          </Link>
          <Link
            href="/app/join"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-white/80 hover:shadow-md"
          >
            Unirme con enlace
          </Link>
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-white/80 hover:shadow-md"
          >
            Landing
          </Link>
          <button
            onClick={() => {
              clearTokens();
              window.location.href = '/auth/login';
            }}
            className="convos-btn-primary px-5 py-2 text-sm"
          >
            Salir
          </button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="convos-card p-6">
          <div className="text-sm font-bold text-slate-800">Tu perfil</div>
          {loading ? (
            <div className="mt-2 text-sm text-slate-500">Cargando…</div>
          ) : me ? (
            <div className="mt-3 grid gap-1 text-sm">
              <div className="font-semibold text-slate-800">{me.name ?? me.email}</div>
              <div className="text-slate-600">{me.email}</div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                Nivel {me.level} · {me.totalPoints} pts
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">
              No estás logueado.{' '}
              <Link className="font-semibold text-violet-700 hover:underline" href="/auth/login">
                Inicia sesión
              </Link>
            </div>
          )}
        </div>

        <div className="convos-card p-6 lg:col-span-2">
          <div className="text-sm font-bold text-slate-800">Tus grupos</div>
          <p className="mt-1 text-sm text-slate-600">Crea un espacio y arma planes con validación y puntos.</p>

          {me ? (
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={createGroup}>
              <label className="convos-label min-w-0 flex-1">
                <span className="font-medium text-slate-700">Nombre del grupo</span>
                <input
                  className="convos-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Los viernes salimos"
                  maxLength={80}
                />
              </label>
              <label className="convos-label w-full sm:w-40">
                <span className="font-medium text-slate-700">Tipo</span>
                <select
                  className="convos-input"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as GroupType)}
                >
                  {GROUP_TYPES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="convos-btn-primary h-11 shrink-0 px-6 text-sm disabled:opacity-60" disabled={creating || !newName.trim()}>
                {creating ? 'Creando…' : 'Crear grupo'}
              </button>
            </form>
          ) : null}

          {groupsError ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{groupsError}</div>
          ) : null}

          <ul className="mt-5 grid gap-2">
            {!me ? null : groupsLoading || groups === null ? (
              <li className="text-sm text-slate-500">Cargando grupos…</li>
            ) : groups.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-6 text-center text-sm text-slate-600">
                Aún no tienes grupos. Crea uno arriba o{' '}
                <Link href="/app/join" className="font-semibold text-violet-700 hover:underline">
                  únete con un enlace
                </Link>
                .
              </li>
            ) : (
              groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/app/groups/${g.id}`}
                    className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-sm ring-1 ring-violet-100/60 transition-all hover:bg-white hover:shadow-md"
                  >
                    <span className="font-semibold text-slate-800">{g.name}</span>
                    <span className="text-xs font-medium text-violet-600">Ver →</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="convos-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">Arena (competitivo)</div>
              <p className="mt-1 text-sm text-slate-600">
                Ranking semanal por puntos. Compites con otros grupos del mismo tipo.
              </p>
            </div>
            <label className="convos-label w-full sm:w-44">
              <span className="font-medium text-slate-700">Categoría</span>
              <select className="convos-input" value={arenaType} onChange={(e) => setArenaType(e.target.value as GroupType)}>
                {GROUP_TYPES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {arenaError ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{arenaError}</div> : null}

          <ol className="mt-4 space-y-2 text-sm">
            {arenaLoading ? (
              <li className="text-slate-500">Cargando ranking…</li>
            ) : !arena?.length ? (
              <li className="rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-6 text-center text-sm text-slate-600">
                Aún no hay puntos en esta arena. Crea planes y valida para sumar.
              </li>
            ) : (
              arena.map((row) => (
                <li
                  key={row.group.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm ring-1 ring-violet-100/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">
                      <span className="mr-2 font-mono text-xs text-violet-600">#{row.rank}</span>
                      {row.group.name}
                    </div>
                    <div className="text-xs text-slate-500">Liga: {tierLabel(row.tier)} · 30d: {row.points30d} pts</div>
                  </div>
                  <div className="shrink-0 font-semibold text-violet-800">{row.points} pts</div>
                </li>
              ))
            )}
          </ol>

          <div className="mt-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Tus grupos en esta arena</div>
            <ul className="mt-2 space-y-2 text-sm">
              {arenaLoading ? (
                <li className="text-slate-500">Cargando tus posiciones…</li>
              ) : !arenaMe?.length ? (
                <li className="text-slate-500">No tienes grupos de este tipo.</li>
              ) : (
                arenaMe.map((row) => (
                  <li
                    key={row.group.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/60 px-4 py-3 ring-1 ring-violet-100/40"
                  >
                    <Link href={`/app/groups/${row.group.id}`} className="min-w-0 font-semibold text-slate-800 hover:underline">
                      {row.group.name}
                    </Link>
                    <div className="shrink-0 text-xs text-slate-500">
                      Puesto: {row.rank ?? '—'} · Liga: {tierLabel(row.tier)} · 7d: {row.points} pts
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="convos-card p-6">
          <div className="text-sm font-bold text-slate-800">Cómo subir</div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600">
            Los puntos se ganan al validar planes. Piensa en esto como “arenas”: juega en tu categoría (pareja/familia/amigos)
            y sube ligas por consistencia.
          </div>
        </div>
      </section>
    </div>
  );
}
