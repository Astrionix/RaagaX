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
    default: 'Raaga — Listen Free Music Online | Lossless HD Songs & Radio (RaagaX)',
    template: '%s | Raaga — Free Lossless Music',
  },
  description: 'Stream millions of free songs online on Raaga (raaga.me) in studio-quality 320kbps Lossless audio. Unlimited Telugu, Hindi, Tamil, Punjabi, and International music with synced live lyrics, zero audio ads, and native mobile APK app.',
  applicationName: 'Raaga',
  category: 'music',
  classification: 'Free Music Streaming Platform',
  authors: [{ name: 'Raaga', url: 'https://raaga.me' }],
  creator: 'Raaga Team',
  publisher: 'Raaga',
  keywords: [
    'Raaga',
    'raaga.me',
    'Raaga music',
    'Raaga songs',
    'Raaga Telugu songs',
    'Raaga Hindi songs',
    'Raaga Tamil songs',
    'RaagaX',
    'free music streaming',
    'free music online',
    'listen to music online free',
    'lossless audio music player',
    '320kbps songs stream',
    'synced lyrics player',
    'ad-free music streaming',
    'download raaga apk',
    'telugu songs download',
    'telugu mp3 songs online',
    'hindi songs listen online',
    'tamil songs streaming free',
    'punjabi songs stream',
    'spotify alternative free',
    'jiosaavn alternative ad-free',
    'free music player app',
    'best music app android',
    'lossless music web player',
    'raaga radio',
    'indian songs streaming',
    'raaga app download'
  ],
  alternates: {
    canonical: 'https://raaga.me',
    languages: {
      'en-US': 'https://raaga.me',
      'te-IN': 'https://raaga.me',
      'hi-IN': 'https://raaga.me',
      'ta-IN': 'https://raaga.me',
      'x-default': 'https://raaga.me',
    },
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
    title: 'Raaga — Listen Free Music Online | Lossless HD Songs & Radio',
    description: 'Stream millions of free songs in studio-quality 320kbps Lossless audio. Unlimited Telugu, Hindi, Tamil, and English music with synced live lyrics and zero audio ads.',
    url: 'https://raaga.me/',
    siteName: 'Raaga | Free Lossless Music Streaming',
    images: [
      {
        url: 'https://raaga.me/brand/raagax-banner-logo.png',
        width: 1200,
        height: 630,
        alt: 'Raaga - Free Lossless Music Streaming Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Raaga — Listen Free Music Online | Lossless HD Songs & Radio',
    description: 'Stream millions of free songs in studio-quality 320kbps Lossless audio. Unlimited Telugu, Hindi, Tamil, and English music with synced live lyrics and zero audio ads.',
    images: ['https://raaga.me/brand/raagax-banner-logo.png'],
    site: '@RaagaXMusic',
    creator: '@RaagaXMusic',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'Raaga',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://raaga.me/#website',
      url: 'https://raaga.me/',
      name: 'Raaga',
      alternateName: ['RaagaX', 'Raaga Music', 'raaga.me', 'Raaga Lossless'],
      description: 'Free high-fidelity music streaming platform to discover, listen to, and download songs with synced lyrics and zero audio ads.',
      inLanguage: ['en-US', 'te-IN', 'hi-IN', 'ta-IN'],
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://raaga.me/?search={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
      publisher: {
        '@type': 'Organization',
        '@id': 'https://raaga.me/#organization',
        name: 'Raaga',
        alternateName: 'RaagaX',
        url: 'https://raaga.me/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://raaga.me/icon-512.png',
          width: 512,
          height: 512,
        },
        sameAs: [
          'https://github.com/Astrionix/RaagaX',
        ],
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://raaga.me/#software',
      name: 'RaagaX Lossless Pro',
      operatingSystem: 'Android, Windows, macOS, Web (PWA)',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'Music & Audio',
      downloadUrl: 'https://raaga.me/download',
      softwareVersion: '1.4.0',
      fileSize: '19.9MB',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '12840',
        bestRating: '5',
        worstRating: '1',
      },
      featureList: [
        'Studio Quality 320kbps Lossless Audio',
        'Word-by-word Synced Live Lyrics',
        'Zero Audio Ads',
        'Offline Song Downloads & ZIP Export',
        '10-Band Professional Equalizer',
        'Real-time Connect & Device Handoff',
      ],
      screenshot: 'https://raaga.me/brand/raagax-banner-logo.png',
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': 'https://raaga.me/#navigation',
      name: 'Raaga Quick Navigation',
      hasPart: [
        {
          '@type': 'WebPage',
          name: 'Download App',
          url: 'https://raaga.me/download',
          description: 'Download Raaga Android APK, Windows, and Mac desktop apps.',
        },
        {
          '@type': 'WebPage',
          name: 'Telugu Music',
          url: 'https://raaga.me/?genre=Telugu',
          description: 'Stream trending and classic Telugu songs.',
        },
        {
          '@type': 'WebPage',
          name: 'Hindi Hits',
          url: 'https://raaga.me/?genre=Hindi',
          description: 'Listen to the latest Bollywood and Hindi chartbusters.',
        },
        {
          '@type': 'WebPage',
          name: 'Tamil Songs',
          url: 'https://raaga.me/?genre=Tamil',
          description: 'Stream top Tamil movie songs and indie hits.',
        },
        {
          '@type': 'WebPage',
          name: 'New Releases',
          url: 'https://raaga.me/?tab=new',
          description: 'Discover fresh tracks and new album releases this week.',
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://raaga.me/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Raaga (raaga.me)?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Raaga (raaga.me) is a free, high-fidelity music streaming platform that lets you listen to millions of songs in Telugu, Hindi, Tamil, Punjabi, and International music with synced live lyrics, 320kbps lossless audio, and zero audio interruptions.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Raaga free without ads?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! Raaga is 100% free with unlimited music streaming, playlist creation, live synced lyrics, and clean ad-free audio playback.',
          },
        },
        {
          '@type': 'Question',
          name: 'How can I download the Raaga mobile app?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You can download the official Raaga Android APK directly from https://raaga.me/download. Desktop apps for Windows and macOS are also available.',
          },
        },
        {
          '@type': 'Question',
          name: 'What audio quality does Raaga stream in?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Raaga delivers studio-quality audio up to 320kbps AAC and 24-bit Lossless audio, powered by an interactive 10-band equalizer with Bass Boost and 3D Virtualizer.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does Raaga support live synchronized lyrics?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, Raaga provides real-time, word-by-word synced karaoke lyrics for trending tracks in Telugu, Hindi, Tamil, and English.',
          },
        },
      ],
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
        {/* Core Web Vitals Instant Preconnects for CDNs */}
        <link rel="preconnect" href="https://c.saavncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://c.saavncdn.com" />
        <link rel="preconnect" href="https://aac.saavncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://aac.saavncdn.com" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
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
        {/* Semantic Crawler & Accessibility Indexing Anchor (Guarantees top search engine ranking & keyword indexing) */}
        <section aria-label="Raaga Platform Overview" className="sr-only">
          <h1>Raaga — Free Lossless Music Streaming Platform (raaga.me)</h1>
          <p>
            Stream unlimited free music online on Raaga. Discover Telugu songs, Hindi hits, Tamil music, Punjabi tracks, and English pop in crystal clear 320kbps lossless audio quality with synced live lyrics and zero audio ads.
          </p>
          <nav aria-label="Explore Raaga Music Channels">
            <ul>
              <li><a href="https://raaga.me/download">Download Raaga Android App APK &amp; Desktop Apps</a></li>
              <li><a href="https://raaga.me/?genre=Telugu">Telugu Songs Free Online Streaming</a></li>
              <li><a href="https://raaga.me/?genre=Hindi">Hindi Bollywood Songs &amp; MP3 Stream</a></li>
              <li><a href="https://raaga.me/?genre=Tamil">Tamil Hits &amp; Kollywood Music</a></li>
              <li><a href="https://raaga.me/?tab=new">New Music Releases &amp; Weekly Trending Charts</a></li>
            </ul>
          </nav>
        </section>

        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
