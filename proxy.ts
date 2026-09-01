import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

// Protects the dashboard (the app's main page) with a single shared
// password (this is a personal tool, not a multi-user product), enforced
// via a signed session cookie set by the /login page rather than a raw
// browser Basic Auth prompt.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (await isValidSessionToken(token, process.env.DASHBOARD_PASSWORD)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/'],
};
