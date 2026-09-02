'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, timingSafeEqual } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const password = formData.get('password');
  const correctPassword = process.env.DASHBOARD_PASSWORD;

  if (typeof password !== 'string' || !correctPassword || !timingSafeEqual(password, correctPassword)) {
    redirect('/login?error=1');
  }

  const token = await createSessionToken(correctPassword);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect('/');
}
