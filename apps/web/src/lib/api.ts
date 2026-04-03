/**
 * Por defecto `/api/v1`: misma origen que la web; Next reenvía a Nest (next.config rewrites).
 * Producción: `https://tu-api.up.railway.app/api/v1` (si falta `https://`, se asume https).
 */
function normalizeApiBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return '/api/v1';
  let u = raw.replace(/\/$/, '').trim();
  const fixV2 = (s: string) => s.replace(/\/api\/v2(\/|$)/gi, '/api/v1$1');
  if (u.startsWith('/')) return fixV2(u);
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return fixV2(u);
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

/**
 * Origen solo para `/uploads/...` si usas `/api/v1` relativo en la web (proxy en Vercel).
 * Ej.: `https://tu-api.up.railway.app` (sin `/api/v1`).
 */
const UPLOADS_ORIGIN = process.env.NEXT_PUBLIC_UPLOADS_ORIGIN?.replace(/\/$/, '').trim();

export type ApiError = {
  status: number;
  message: string;
};

/** `/uploads/...` o URL absoluta → URL usable en `<img src>` (dominio de la API en producción). */
export function resolvePublicAssetUrl(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  const h = href.trim();
  if (h.startsWith('http://') || h.startsWith('https://')) return h;
  if (!h.startsWith('/')) return null;

  if (UPLOADS_ORIGIN) {
    return `${UPLOADS_ORIGIN}${h}`;
  }

  if (API_BASE_URL.startsWith('/')) {
    if (typeof window === 'undefined') return h;
    return `${window.location.origin}${h}`;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  return `${origin}${h}`;
}

/** URL absoluta para rutas devueltas por la API (p. ej. subida de fotos), según cómo esté configurado el cliente. */
export function absoluteUrlForApiPath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (API_BASE_URL.startsWith('/')) return path;
  return new URL(path, `${API_BASE_URL}/`).href;
}

export function isAbortError(e: unknown): boolean {
  return (
    (typeof e === 'object' &&
      e !== null &&
      'name' in e &&
      (e as { name: string }).name === 'AbortError') ||
    (e instanceof DOMException && e.name === 'AbortError')
  );
}

async function request<T>(
  path: string,
  opts?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
  },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts?.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(opts?.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: opts?.signal,
    });
  } catch (e: unknown) {
    if (isAbortError(e)) throw e;
    const hint =
      API_BASE_URL.startsWith('/')
        ? 'Comprueba que la API esté en marcha (npm run dev:api en la raíz del monorepo) y que Docker tenga Postgres y Redis si los usas (npm run db:up).'
        : 'Comprueba que la URL en NEXT_PUBLIC_API_BASE_URL sea correcta y que el backend esté en marcha.';
    const raw = e instanceof Error ? e.message : String(e);
    throw {
      status: 0,
      message:
        raw === 'Failed to fetch' || raw.includes('fetch')
          ? `No se pudo conectar con el servidor. ${hint}`
          : raw,
    } satisfies ApiError;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text || res.statusText;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json') && text) {
      try {
        const j = JSON.parse(text) as { message?: string | string[]; error?: string };
        if (Array.isArray(j.message)) message = j.message.join(', ');
        else if (typeof j.message === 'string') message = j.message;
        else if (typeof j.error === 'string') message = j.error;
      } catch {
        /* mantener texto crudo */
      }
    }
    throw {
      status: res.status,
      message,
    } satisfies ApiError;
  }

  return (await res.json()) as T;
}

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    level: number;
    totalPoints: number;
  };
};

export type GroupMemberRow = {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
};

export type GroupType = 'couple' | 'friends' | 'family' | 'other';
export type PlanType = 'date' | 'food' | 'trip' | 'sport' | 'hangout' | 'other';

export type GroupSummary = {
  id: string;
  name: string;
  type: GroupType;
  createdAt: string;
};

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
};

export type PlanSummary = {
  id: string;
  title: string;
  type: PlanType;
  status: string;
  scheduledAt: string;
  place: Place;
  groupId: string;
  createdBy?: string;
  locationRadiusM?: number;
  requiresAllConfirm?: boolean;
};

/** Validación en un plan: visible para todos los miembros del grupo. */
export type PlanValidationMemberView = {
  id: string;
  status: string;
  submittedAtServer: string;
  photo: { id: string; publicUrl: string | null } | null;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
};

export type PlanDetail = PlanSummary & {
  canEdit?: boolean;
  validations?: PlanValidationMemberView[];
};

export type PlanSuggestionRow = {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  type: PlanType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string | null; email: string; avatarUrl: string | null };
};

export type GroupValidationPhotoRow = {
  id: string;
  status: string;
  submittedAtServer: string;
  photo: { publicUrl: string | null };
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  plan: { id: string; title: string };
};

export type LeaderboardRow = {
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    totalPoints: number;
    level: number;
  };
  weekPoints: number;
};

export type FeedItem = {
  id: string;
  groupId: string;
  type: string;
  planId: string | null;
  occurredAt: string;
  payload: Record<string, unknown> | null;
  actor: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  plan: { id: string; title: string } | null;
};

export type ArenaTier = 'bronze' | 'silver' | 'gold' | 'master' | 'legend';

export type ArenaLeaderboardRow = {
  rank: number;
  group: { id: string; name: string; type: GroupType };
  points: number;
  tier: ArenaTier;
  points30d: number;
};

export type ArenaMyRow = {
  group: { id: string; name: string; type: GroupType };
  points: number;
  rank: number | null;
  tier: ArenaTier;
  points30d: number;
};

export type ProfileValidationRow = {
  id: string;
  status: string;
  submittedAtServer: string;
  photo: { id: string; publicUrl: string | null };
  plan: {
    id: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string;
    group: { id: string; name: string };
    place: { name: string };
  };
};

export type ProfilePointsRow = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  group: { id: string; name: string };
  plan: { id: string; title: string } | null;
};

export type ProfileActivityResponse = {
  user: AuthResponse['user'];
  validations: ProfileValidationRow[];
  pointsLedger: ProfilePointsRow[];
};

/** URL para mostrar fotos subidas (`/uploads/...` en el host de la API). */
export function uploadPublicUrl(publicUrl: string | null | undefined): string | null {
  return resolvePublicAssetUrl(publicUrl);
}

export const api = {
  health: () => request<{ ok: true }>('/'),
  vapidPublicKey: () => request<{ publicKey: string }>('/notifications/vapid-public-key'),

  register: (body: { email: string; password: string; name?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),
  refresh: (body: { refreshToken: string }) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body }),
  me: (token: string, signal?: AbortSignal) => request<AuthResponse['user']>('/me', { token, signal }),
  updateProfile: (token: string, body: { name?: string; bio?: string | null }) =>
    request<AuthResponse['user']>('/me', { method: 'PATCH', token, body }),
  async uploadAvatar(token: string, file: File): Promise<AuthResponse['user']> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE_URL}/me/avatar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      let message = text || res.statusText;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json') && text) {
        try {
          const j = JSON.parse(text) as { message?: string | string[]; error?: string };
          if (Array.isArray(j.message)) message = j.message.join(', ');
          else if (typeof j.message === 'string') message = j.message;
          else if (typeof j.error === 'string') message = j.error;
        } catch {
          /* keep */
        }
      }
      throw { status: res.status, message } satisfies ApiError;
    }
    return JSON.parse(text) as AuthResponse['user'];
  },
  meActivity: (token: string, signal?: AbortSignal) =>
    request<ProfileActivityResponse>('/me/activity', { token, signal }),

  groups: {
    list: (token: string, signal?: AbortSignal) => request<GroupSummary[]>('/groups', { token, signal }),
    get: (token: string, groupId: string, signal?: AbortSignal) =>
      request<GroupSummary>(`/groups/${groupId}`, { token, signal }),
    create: (token: string, body: { name: string; type: GroupType }) =>
      request<GroupSummary>('/groups', { method: 'POST', token, body }),
    createInvite: (
      token: string,
      groupId: string,
      body?: { expiresInDays?: number; maxUses?: number },
    ) =>
      request<{ id: string; token: string; expiresAt: string; maxUses: number | null }>(
        `/groups/${groupId}/invites`,
        { method: 'POST', token, body },
      ),
    joinByToken: (token: string, inviteToken: string) =>
      request<{ groupId: string }>(`/invites/${inviteToken}/join`, { method: 'POST', token }),
    members: (token: string, groupId: string, signal?: AbortSignal) =>
      request<GroupMemberRow[]>(`/groups/${groupId}/members`, { token, signal }),
    validationPhotos: (token: string, groupId: string, limit = 30, signal?: AbortSignal) =>
      request<GroupValidationPhotoRow[]>(`/groups/${groupId}/validation-photos?limit=${limit}`, {
        token,
        signal,
      }),
    leaderboard: (token: string, groupId: string, range?: '7d' | '30d', signal?: AbortSignal) => {
      const q = range === '30d' ? '?range=30d' : '';
      return request<LeaderboardRow[]>(`/groups/${groupId}/leaderboard${q}`, { token, signal });
    },
    activeChallenges: (token: string, groupId: string, signal?: AbortSignal) =>
      request<unknown[]>(`/groups/${groupId}/challenges/active`, { token, signal }),
    feed: (token: string, groupId: string, opts?: { limit?: number; signal?: AbortSignal }) => {
      const limit = opts?.limit ?? 40;
      return request<FeedItem[]>(`/groups/${groupId}/feed?limit=${limit}`, { token, signal: opts?.signal });
    },
  },

  plans: {
    listByGroup: (token: string, groupId: string, signal?: AbortSignal) =>
      request<PlanSummary[]>(`/groups/${groupId}/plans`, { token, signal }),
    create: (
      token: string,
      groupId: string,
      body: {
        title: string;
        type: PlanType;
        scheduledAt: string;
        place: { name: string; address: string; lat: string; lng: string };
        locationRadiusM?: number;
        requiresAllConfirm?: boolean;
      },
    ) => request<PlanSummary>(`/groups/${groupId}/plans`, { method: 'POST', token, body }),
    get: (token: string, planId: string, signal?: AbortSignal) =>
      request<PlanDetail>(`/plans/${planId}`, { token, signal }),
    update: (
      token: string,
      planId: string,
      body: {
        title?: string;
        type?: PlanType;
        scheduledAt?: string;
        place?: { name: string; address: string; lat: string; lng: string; googlePlaceId?: string };
        locationRadiusM?: number;
        requiresAllConfirm?: boolean;
      },
      signal?: AbortSignal,
    ) => request<PlanDetail>(`/plans/${planId}`, { method: 'PATCH', token, body, signal }),
    cancel: (token: string, planId: string, reason?: string) =>
      request<PlanSummary>(`/plans/${planId}/cancel`, { method: 'POST', token, body: { reason } }),
  },

  planSuggestions: {
    list: (token: string, groupId: string, signal?: AbortSignal) =>
      request<PlanSuggestionRow[]>(`/groups/${groupId}/plan-suggestions`, { token, signal }),
    create: (
      token: string,
      groupId: string,
      body: { title: string; type: PlanType; note?: string },
    ) =>
      request<PlanSuggestionRow>(`/groups/${groupId}/plan-suggestions`, { method: 'POST', token, body }),
    update: (
      token: string,
      groupId: string,
      suggestionId: string,
      body: { title?: string; type?: PlanType; note?: string | null },
    ) =>
      request<PlanSuggestionRow>(`/groups/${groupId}/plan-suggestions/${suggestionId}`, {
        method: 'PATCH',
        token,
        body,
      }),
    remove: (token: string, groupId: string, suggestionId: string) =>
      request<{ ok: true }>(`/groups/${groupId}/plan-suggestions/${suggestionId}`, {
        method: 'DELETE',
        token,
      }),
    schedule: (
      token: string,
      groupId: string,
      suggestionId: string,
      body: {
        scheduledAt: string;
        place: { name: string; address: string; lat: string; lng: string };
        locationRadiusM?: number;
        requiresAllConfirm?: boolean;
      },
    ) =>
      request<{ planId: string; plan: PlanSummary }>(
        `/groups/${groupId}/plan-suggestions/${suggestionId}/schedule`,
        { method: 'POST', token, body },
      ),
  },

  notifications: {
    subscribe: (
      token: string,
      body: { endpoint: string; keys: { p256dh: string; auth: string } },
    ) => request<unknown>('/notifications/subscribe', { method: 'POST', token, body }),
    unsubscribe: (token: string, endpoint: string) =>
      request<unknown>('/notifications/unsubscribe', { method: 'POST', token, body: { endpoint } }),
  },

  validation: {
    init: (token: string, planId: string) =>
      request<{ photoId: string; uploadUrl: string; constraints: unknown }>(`/plans/${planId}/validation/init`, {
        method: 'POST',
        token,
      }),
    submit: (
      token: string,
      planId: string,
      body: {
        photoId: string;
        capturedAtClient: string;
        lat: number;
        lng: number;
        gpsAccuracyM?: number;
        deviceInfo?: unknown;
      },
    ) => request<unknown>(`/plans/${planId}/validation/submit`, { method: 'POST', token, body }),
    status: (token: string, planId: string) =>
      request<unknown[]>(`/plans/${planId}/validation/status`, { token }),
  },

  arena: {
    leaderboard: (
      token: string,
      input?: { type?: GroupType; range?: '7d' | '30d'; limit?: number; signal?: AbortSignal },
    ) => {
      const { signal, ...rest } = input ?? {};
      const q = new URLSearchParams();
      if (rest.type) q.set('type', rest.type);
      if (rest.range === '30d') q.set('range', '30d');
      if (typeof rest.limit === 'number') q.set('limit', String(rest.limit));
      const qs = q.toString();
      return request<ArenaLeaderboardRow[]>(`/arena/leaderboard${qs ? `?${qs}` : ''}`, { token, signal });
    },
    me: (token: string, input?: { type?: GroupType; range?: '7d' | '30d'; signal?: AbortSignal }) => {
      const { signal, ...rest } = input ?? {};
      const q = new URLSearchParams();
      if (rest.type) q.set('type', rest.type);
      if (rest.range === '30d') q.set('range', '30d');
      const qs = q.toString();
      return request<ArenaMyRow[]>(`/arena/me${qs ? `?${qs}` : ''}`, { token, signal });
    },
  },
};
