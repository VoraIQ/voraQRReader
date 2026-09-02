import { getLinksWithStats } from '@/lib/db';
import { findPresetForStyle } from '@/lib/qrStyles';
import DashboardHeader from '@/components/DashboardHeader';
import CreateLinkCard from '@/components/CreateLinkCard';
import CreatedLinkLogoDownload from '@/components/CreatedLinkLogoDownload';
import QrPreview from '@/components/QrPreview';
import DeleteLinkButton from '@/components/DeleteLinkButton';

export const dynamic = 'force-dynamic';

function displayRedirect(redirectUrl: string): string {
  return redirectUrl.replace(/^https?:\/\//, '');
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const links = await getLinksWithStats();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const rows = links.map((link) => ({
    ...link,
    redirectUrl: `${baseUrl}/r/${link.code}`,
  }));

  const totalScans = rows.reduce((sum, r) => sum + r.scanCount, 0);
  const totalActions = rows.reduce((sum, r) => sum + r.actionCount, 0);
  const createdLink = created ? rows.find((r) => r.code === created) : undefined;

  return (
    <>
      <DashboardHeader codes={rows.length} scans={totalScans} actions={totalActions} />

      <CreateLinkCard />

      {createdLink && (
        <div className="success-banner">
          <span className="viq-dot viq-dot--success" />
          <span className="success-banner-title">Code created</span>
          <span className="mono success-banner-url">{displayRedirect(createdLink.redirectUrl)}</span>
          <span className="caption success-banner-meta">Print it, then watch scans land below</span>
          <CreatedLinkLogoDownload redirectUrl={createdLink.redirectUrl} style={createdLink.style} />
        </div>
      )}

      <section className="codes-section">
        <div className="codes-header">
          <h2>Your codes</h2>
          <span className="caption">{rows.length > 0 ? 'Newest first' : ''}</span>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state-mesh empty-state">
            <div className="viq-glass viq-glass--static empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="5" height="5" x="3" y="3" rx="1" />
                <rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" />
                <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" />
                <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                <path d="M3 12h.01" />
                <path d="M12 3h.01" />
                <path d="M12 16v.01" />
                <path d="M16 12h1" />
                <path d="M21 12v.01" />
                <path d="M12 21v-1" />
              </svg>
            </div>
            <h3>No QR codes yet</h3>
            <p className="type-body-sm empty-state-body">
              Add a destination URL above, pick a style, and create your first code. Scans and conversions show up
              here as they come in.
            </p>
          </div>
        ) : (
          rows.map((link) => {
            const preset = findPresetForStyle(link.style);
            return (
              <div className="card code-row" key={link.id}>
                <div className="code-row-qr">
                  <QrPreview
                    url={link.redirectUrl}
                    style={link.style}
                    size={116}
                    showDownload
                    downloadName={link.label ? link.label.trim().replace(/\s+/g, '-').toLowerCase() : link.code}
                  />
                </div>
                <div className="code-row-info">
                  <div className="code-row-title">
                    <span className="code-row-title-text">{link.label || 'Untitled code'}</span>
                    <span className="viq-badge">{preset?.name ?? 'Custom'}</span>
                  </div>
                  <a href={link.destinationUrl} target="_blank" rel="noreferrer" className="type-body-sm code-row-dest">
                    {link.destinationUrl}
                  </a>
                  <span className="mono code-row-redirect">{displayRedirect(link.redirectUrl)}</span>
                  {link.scanCount === 0 && (
                    <span className="caption code-row-warning">Not scanned yet · check that the printed code resolves</span>
                  )}
                </div>
                <div className="code-row-stats">
                  <div className="stat-block">
                    <span className="overline">Scans</span>
                    <span className="stat-block-value">{link.scanCount.toLocaleString()}</span>
                  </div>
                  <div className="stat-block">
                    <span className="overline">Actions</span>
                    <span className="stat-block-value">{link.actionCount.toLocaleString()}</span>
                  </div>
                  <div className="stat-block">
                    <span className="overline">Conv. rate</span>
                    <span className="stat-block-value stat-block-value-accent">
                      {link.scanCount > 0 ? `${Math.round((link.actionCount / link.scanCount) * 100)}%` : '—'}
                    </span>
                  </div>
                </div>
                <div className="code-row-delete">
                  <DeleteLinkButton id={link.id} label={link.label || 'Untitled code'} />
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
