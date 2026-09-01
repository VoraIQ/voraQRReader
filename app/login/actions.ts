'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function loginAction(formData: FormData) {
  const password = formData.get('password');
  const correctPassword = process.env.DASHBOARD_PASSWORD;

  if (typeof password !== 'string' || !correctPassword || password !== correctPassword) {
    redirect('/login?error=1');
  }

  const token = await createSessionToken(correctPassword);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  redirect('/');
}
