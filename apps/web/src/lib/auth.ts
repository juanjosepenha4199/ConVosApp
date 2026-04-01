import { api, AuthResponse } from './api';

const ACCESS_KEY = 'convos.accessToken';
const REFRESH_KEY = 'convos.refreshToken';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export async function fetchMeWithRefresh(): Promise<AuthResponse['user'] | null> {
  const access = getAccessToken();
  if (access) {
    try {
      return await api.me(access);
    } catch {
      // fall through to refresh
    }
  }

  const refresh = getRefreshToken();
  if (!refresh) return null;

  const next = await api.refresh({ refreshToken: refresh });
  setTokens({ accessToken: next.accessToken, refreshToken: next.refreshToken });
  return next.user;
}

