import { logoutAction } from '@/app/actions';

interface DashboardHeaderProps {
  codes: number | null;
  scans: number | null;
  actions: number | null;
}

function formatStat(value: number | null): string {
  return value === null ? '—' : value.toLocaleString();
}

export default function DashboardHeader({ codes, scans, actions }: DashboardHeaderProps) {
  return (
    <header className="dash-header">
      <div className="dash-header-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vora-iq-wordmark.png" alt="Vora IQ" height={22} width={88} style={{ height: 22, width: 'auto', alignSelf: 'flex-start' }} />
        <h1>QR Tracker</h1>
        <p style={{ color: 'var(--color-label-secondary)' }}>Scan and conversion analytics for every code you print.</p>
      </div>
      <div className="dash-header-stats">
        <div className="dash-stat">
          <span className="overline">Codes</span>
          <span className="dash-stat-value">{formatStat(codes)}</span>
        </div>
        <div className="dash-stat">
          <span className="overline">Scans</span>
          <span className="dash-stat-value">{formatStat(scans)}</span>
        </div>
        <div className="dash-stat">
          <span className="overline">Actions</span>
          <span className="dash-stat-value">{formatStat(actions)}</span>
        </div>
      </div>
      <form action={logoutAction} className="dash-signout">
        <button type="submit" className="btn-link">
          Sign out
        </button>
      </form>
    </header>
  );
}
