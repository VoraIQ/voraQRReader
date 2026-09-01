'use client';

import DashboardHeader from '@/components/DashboardHeader';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <DashboardHeader codes={null} scans={null} actions={null} />
      <div className="card error-card">
        <span className="viq-badge viq-badge--danger">
          <span className="viq-dot" style={{ background: 'var(--color-danger)' }} />
          Connection failed
        </span>
        <h3>We couldn&apos;t load your codes</h3>
        <p className="type-body-sm error-card-body">
          The database didn&apos;t respond. Your codes and scan history are safe — this only affects this page.
        </p>
        <button type="button" className="btn-outline btn-sm" onClick={reset}>
          Try again
        </button>
      </div>
    </>
  );
}
