import React from 'react';
import './globals.css';

export const viewport = {
  themeColor: '#EF233C',
};

export const metadata = {
  title: 'RaagaX - Futuristic Music Streaming Platform',
  description: 'Experience studio-grade 320kbps audio, YouTube Music Video mode, and synced lyrics.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'RaagaX',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-white text-slate-900 selection:bg-red-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
