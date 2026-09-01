import './globals.css';

export const metadata = {
  title: 'QR Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="vora-page">
          <div className="vora-container">{children}</div>
        </main>
      </body>
    </html>
  );
}
