import React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const viewport = {
  themeColor: '#EF233C',
};

export const metadata = {
  title: 'RaagaX - Futuristic Music Streaming Platform',
  description: 'Experience studio-grade 320kbps audio and synced lyrics.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Instant CDN Preconnects for 0ms artwork and stream resolution */}
        <link rel="preconnect" href="https://c.saavncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://c.saavncdn.com" />
        <link rel="preconnect" href="https://aac.saavncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://aac.saavncdn.com" />
        <link rel="preconnect" href="https://i.scdn.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.scdn.co" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('raagax_theme_preference');
                  var isDark = stored === 'dark' || (!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = isDark ? 'dark' : 'light';
                  document.documentElement.classList.add(theme);
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.style.colorScheme = theme;
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-red-500 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
