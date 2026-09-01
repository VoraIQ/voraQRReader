import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { loginAction } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, cookieStore] = await Promise.all([searchParams, cookies()]);

  const existingToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionToken(existingToken, process.env.DASHBOARD_PASSWORD)) {
    redirect('/');
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vora-iq-wordmark.png" alt="Vora IQ" height={22} width={88} style={{ height: 22, width: 'auto' }} />
        <h1>QR Tracker</h1>
        <p className="type-body-sm" style={{ color: 'var(--color-label-secondary)' }}>
          Enter the password to view the dashboard.
        </p>
        <form action={loginAction} className="login-form">
          <div className="field">
            <span className="overline">Password</span>
            <input
              type="password"
              name="password"
              autoFocus
              required
              className={`field-input${error ? ' field-input-invalid' : ''}`}
            />
            {error && <span className="caption field-error">Incorrect password</span>}
          </div>
          <button type="submit" className="btn-primary">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
