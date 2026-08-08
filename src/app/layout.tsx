import React from 'react';
import './globals.css';

export const viewport = {
  themeColor: '#EF233C',
};

export const metadata = {
  title: 'RaagaX - Luxury Futuristic Music Streaming Platform',
  description: 'Experience studio-grade 320kbps audio, 3D Vinyl Visualizers, YouTube Music Video mode, and synced lyrics.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased bg-white text-slate-900 selection:bg-red-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
