import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SERS — Smart Emergency Response System',
  description: 'AI-powered emergency response for India. Auto-detects crashes, connects you to the nearest hospital, and dispatches help in seconds.',
  keywords: 'emergency response, SOS, ambulance, hospital, accident detection, ABDM, India',
  openGraph: {
    title: 'SERS — Smart Emergency Response System',
    description: 'Proactive AI emergency response platform for India',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
