# QR Tracker

Personal QR code generator + scan/conversion analytics. Generates a QR code
that points at a redirect endpoint you control, logs every scan, then
forwards the visitor to your real site with a click ID attached so you can
tie a later action (signup, purchase, form fill) back to that specific scan.

Built on Next.js 16 + Postgres (via Neon, provisioned through the Vercel
Marketplace), deployed on Vercel.

## How it works

1. You create a link on the dashboard (the app's main page) with a destination URL.
2. A QR code is generated pointing at `yourapp.vercel.app/r/{code}`.
3. When scanned, `/r/{code}` logs the scan and redirects to your destination
   URL with `?qr_cid=<click id>` appended.
4. You embed `snippet.js` on the destination site. It picks up `qr_cid` from
   the URL and stores it, so you can call `trackQrAction('signup', {...})`
   whenever the visitor does something worth tracking.
5. The dashboard shows scan count, action count, and conversion rate per
   QR code.

Each QR code can have its own dot/corner shape and color pair, picked from
a handful of presets (Classic, Rounded, Dots, Classy) when you create the
link. This is purely cosmetic — it never changes the encoded URL — and is
rendered entirely client-side by `qr-code-styling` (MIT licensed), so there's
no external service and no server-side rendering cost. Each row's QR code
can be downloaded as PNG or SVG.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. In the Vercel dashboard, go to your project's **Storage** tab and add a
   Postgres integration from the Marketplace (Neon is the direct successor
   to the old Vercel Postgres and the simplest choice). This wires up a
   `DATABASE_URL` environment variable automatically.

3. Pull that env var locally:
   ```
   vercel env pull .env.local
   ```

4. Run `schema.sql` against the database once, either by pasting it into
   the Neon/Vercel query editor, or:
   ```
   psql "$DATABASE_URL" -f schema.sql
   ```
   If your database already existed before QR styling was added, also run
   the migration in `migrations/001_add_style_column.sql` (it's already
   included in `schema.sql` for fresh installs).

5. In Vercel Project Settings > Environment Variables, set:
   - `DASHBOARD_PASSWORD` - whatever password you want for the dashboard
   - `NEXT_PUBLIC_BASE_URL` - your deployed URL, e.g. `https://qr-tracker.vercel.app`

   Add the same values to `.env.local` for local testing.

6. Deploy:
   ```
   vercel deploy --prod
   ```

## Using it

- Visit your deployed URL — the dashboard is the app's main page. You'll
  land on a branded login page and enter the password you set; a signed
  session cookie keeps you in for 30 days, and "Sign out" clears it.
- On the site each QR code points to, add:
  ```html
  <script src="https://YOUR-DEPLOYED-URL/snippet.js"></script>
  ```
- When a visitor completes the action you care about:
  ```html
  <script>trackQrAction('signup', { plan: 'pro' });</script>
  ```
  The `metadata` object is optional and stored as-is (JSON) if you want to
  filter by it later directly in Postgres.

## Notes / things to harden later if this grows beyond personal use

- `/api/action` currently accepts requests from any origin (`Access-Control-
  Allow-Origin: *`). Fine for a personal tool; restrict it to your specific
  domain if this ever handles anything sensitive.
- Dashboard auth is a single shared password (a login page at `/login`
  setting a signed session cookie, checked by `proxy.ts`), not per-user
  accounts.
- No rate limiting on the redirect or action endpoints.
