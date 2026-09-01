import QRCode from 'qrcode';
import { getLinksWithStats } from '@/lib/db';
import { createLinkAction } from '@/app/actions';

// Always hit the database fresh - this is a low-traffic personal dashboard,
// not a page that needs caching.
export const dynamic = 'force-dynamic';

async function toQrDataUrl(url: string) {
  return QRCode.toDataURL(url, { width: 160, margin: 1 });
}

export default async function DashboardPage() {
  const links = await getLinksWithStats();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const rows = await Promise.all(
    links.map(async (link) => {
      const redirectUrl = `${baseUrl}/r/${link.code}`;
      return {
        ...link,
        redirectUrl,
        qrDataUrl: await toQrDataUrl(redirectUrl),
      };
    })
  );

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <h1>QR Tracker</h1>

      <form
        action={createLinkAction}
        style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}
      >
        <input
          name="destinationUrl"
          type="url"
          placeholder="https://destination-site.com/page"
          required
          style={{ flex: '2 1 260px', padding: 8 }}
        />
        <input
          name="label"
          type="text"
          placeholder="Label (optional)"
          style={{ flex: '1 1 160px', padding: 8 }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>
          Create QR
        </button>
      </form>

      {rows.length === 0 ? (
        <p>No QR codes yet. Create one above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
              <th style={{ padding: 8 }}>QR</th>
              <th style={{ padding: 8 }}>Label</th>
              <th style={{ padding: 8 }}>Destination</th>
              <th style={{ padding: 8 }}>Scans</th>
              <th style={{ padding: 8 }}>Actions</th>
              <th style={{ padding: 8 }}>Conv. rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((link) => (
              <tr key={link.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: 8 }}>
                  <img src={link.qrDataUrl} width={80} height={80} alt={link.code} />
                </td>
                <td style={{ padding: 8 }}>{link.label || '—'}</td>
                <td style={{ padding: 8, maxWidth: 260, overflowWrap: 'break-word' }}>
                  <a href={link.destinationUrl} target="_blank" rel="noreferrer">
                    {link.destinationUrl}
                  </a>
                </td>
                <td style={{ padding: 8 }}>{link.scanCount}</td>
                <td style={{ padding: 8 }}>{link.actionCount}</td>
                <td style={{ padding: 8 }}>
                  {link.scanCount > 0
                    ? `${Math.round((link.actionCount / link.scanCount) * 100)}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
