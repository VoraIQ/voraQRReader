import { NextRequest, NextResponse } from 'next/server';

// Protects /dashboard with a single shared password (this is a personal
// tool, not a multi-user product, so simple HTTP basic auth is enough).
export function proxy(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.split(' ')[1]);
    const [, password] = decoded.split(':');

    if (password === process.env.DASHBOARD_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="QR Tracker"' },
  });
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
