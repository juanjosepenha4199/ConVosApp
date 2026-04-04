import { api, AuthResponse } from './api';
import { clearTokensStorage, readAccessToken, readRefreshToken, writeTokens } from './auth-storage';

export function getAccessToken() {
  return readAccessToken();
}

export function getRefreshToken() {
  return readRefreshToken();
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  writeTokens(tokens.accessToken, tokens.refreshToken);
}

export function clearTokens() {
  clearTokensStorage();
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

