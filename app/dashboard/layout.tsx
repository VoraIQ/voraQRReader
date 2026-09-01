export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="vora-page">
      <div className="vora-container">{children}</div>
    </main>
  );
}
