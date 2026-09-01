import DashboardHeader from '@/components/DashboardHeader';
import CreateLinkCard from '@/components/CreateLinkCard';

function SkeletonRow() {
  return (
    <div className="card skeleton-row" aria-busy="true">
      <div className="skeleton-qr" />
      <div className="skeleton-lines">
        <div className="skeleton-line" style={{ width: 180 }} />
        <div className="skeleton-line" style={{ width: 260, height: 12 }} />
        <div className="skeleton-line" style={{ width: 210, height: 12 }} />
      </div>
      <div className="skeleton-stats">
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <>
      <DashboardHeader codes={null} scans={null} actions={null} />
      <CreateLinkCard />
      <section className="codes-section">
        <div className="codes-header">
          <h2>Your codes</h2>
          <span className="caption">Loading…</span>
        </div>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </section>
    </>
  );
}
