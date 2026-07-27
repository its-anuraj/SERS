import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SERS Command Center — Smart Emergency Response System',
  description: 'AI-powered emergency dispatch and coordination platform for hospitals, coordinators, and administrators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
