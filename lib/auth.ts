// Session tokens are an HMAC of a fixed payload keyed by DASHBOARD_PASSWORD,
// verified without a database or session store. Rotating the password
// automatically invalidates every existing session, which is desirable.
// Uses only Web Crypto (`crypto.subtle`), so this runs in both the Edge
// middleware and the Node server-action runtime.

export const SESSION_COOKIE_NAME = 'qr_tracker_session';

const SESSION_PAYLOAD = 'qr-tracker-authenticated';

async function computeSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_PAYLOAD));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(password: string): Promise<string> {
  return computeSessionToken(password);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function isValidSessionToken(token: string | undefined, password: string | undefined): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await computeSessionToken(password);
  return timingSafeEqual(token, expected);
}
