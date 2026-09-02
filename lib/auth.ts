// Session tokens are an HMAC of a payload (a fixed marker plus an
// issued-at timestamp) keyed by DASHBOARD_PASSWORD, verified without a
// database or session store. Rotating the password invalidates every
// existing session at once. The embedded timestamp bounds how long a
// leaked token stays valid — sign-out only clears the browser's cookie
// (there's no server-side session store to revoke against), so without an
// expiry a copied cookie value would otherwise work forever.
// Uses only Web Crypto (`crypto.subtle`), so this runs in both the Edge
// middleware and the Node server-action runtime.

export const SESSION_COOKIE_NAME = 'qr_tracker_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — keep in sync with the cookie's own maxAge

const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const SESSION_PAYLOAD = 'qr-tracker-authenticated';

async function signSessionPayload(password: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(password: string): Promise<string> {
  const issuedAt = Date.now();
  const signature = await signSessionPayload(password, `${SESSION_PAYLOAD}:${issuedAt}`);
  return `${issuedAt}.${signature}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function isValidSessionToken(token: string | undefined, password: string | undefined): Promise<boolean> {
  if (!token || !password) return false;

  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;
  const issuedAtRaw = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() || Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
    return false;
  }

  const expected = await signSessionPayload(password, `${SESSION_PAYLOAD}:${issuedAtRaw}`);
  return timingSafeEqual(signature, expected);
}
