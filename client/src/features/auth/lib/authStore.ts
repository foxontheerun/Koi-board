// Token storage for auth. The access token lives in memory only (limits XSS
// exposure); the refresh token is persisted so a reload can restore the session.
// Apollo's links read the access token here at request time, so it must be a
// plain module singleton, not React state.

const REFRESH_KEY = "koi:refreshToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // localStorage unavailable — the session simply won't survive a reload.
  }
}

// Stores both tokens after a successful login/signup/refresh.
export function setSession(access: string, refresh: string): void {
  setAccessToken(access);
  setRefreshToken(refresh);
}

// Wipes both tokens on logout.
export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}
