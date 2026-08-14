import React from 'react';
import './globals.css';
import { DeviceSyncProvider } from '@/components/providers/DeviceSyncProvider';
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
      <body className="antialiased selection:bg-red-500 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <DeviceSyncProvider>
            {children}
          </DeviceSyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
