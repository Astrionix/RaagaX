import React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

import '@/lib/utils/uuid';

export const viewport = {
  themeColor: '#EF233C',
};

export const metadata = {
  metadataBase: new URL('https://raaga.me'),
  title: {
    default: 'RaagaX - Music Streaming Platform',
    template: '%s | RaagaX',
  },
  description: 'RaagaX is a modern music streaming platform to discover, listen to and enjoy music across your devices.',
  applicationName: 'RaagaX',
  authors: [{ name: 'RaagaX' }],
  keywords: [
    'Raaga',
    'RaagaX',
    'raaga.me',
    'music streaming',
    'free music streaming',
    'lossless audio',
    'listen to music online',
    'synced lyrics',
    'web music player',
    'Telugu music',
    'Hindi music',
    'English music'
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'RaagaX - Music Streaming Platform',
    description: 'RaagaX is a modern music streaming platform to discover, listen to and enjoy music across your devices.',
    url: 'https://raaga.me/',
    siteName: 'RaagaX',
    images: [
      {
        url: '/brand/raagax-banner-logo.png',
        width: 1024,
        height: 341,
        alt: 'RaagaX - Music Streaming Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RaagaX - Music Streaming Platform',
    description: 'RaagaX is a modern music streaming platform to discover, listen to and enjoy music across your devices.',
    images: ['/brand/raagax-banner-logo.png'],
  },
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://raaga.me/#website',
      url: 'https://raaga.me/',
      name: 'RaagaX',
      description: 'RaagaX is a modern music streaming platform to discover, listen to and enjoy music across your devices.',
      inLanguage: 'en-US',
      publisher: {
        '@type': 'Organization',
        name: 'RaagaX',
        url: 'https://raaga.me/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://raaga.me/icon-512.png',
        },
      },
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://raaga.me/#webapp',
      url: 'https://raaga.me/',
      name: 'RaagaX',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires JavaScript. Requires HTML5 Audio.',
      description: 'RaagaX is a modern music streaming platform to discover, listen to and enjoy music across your devices.',
      image: 'https://raaga.me/brand/raagax-banner-logo.png',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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

                  if (typeof window !== 'undefined') {
                    if (!window.crypto) {
                      window.crypto = {};
                    }
                    if (typeof window.crypto.randomUUID !== 'function') {
                      window.crypto.randomUUID = function() {
                        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                          var r = Math.random() * 16 | 0;
                          var v = c === 'x' ? r : (r & 0x3 | 0x8);
                          return v.toString(16);
                        });
                      };
                    }
                  }
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
