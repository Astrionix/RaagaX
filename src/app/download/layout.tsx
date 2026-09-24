import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Raaga App — Android APK (v1.4.0), Windows & Mac | Raaga (raaga.me)',
  description: 'Download the official Raaga (RaagaX) music app for Android (APK), Windows, and macOS. Stream unlimited Telugu, Hindi, Tamil, and English music in 320kbps Lossless audio with offline downloads and zero ads.',
  applicationName: 'Raaga',
  keywords: [
    'download raaga app',
    'raaga apk download',
    'raaga android app',
    'raaga music download',
    'raaga apk latest version',
    'raaga windows player',
    'raaga mac download',
    'raaga.me download',
    'free music player apk',
    'lossless audio player android apk',
    'ad free music app download'
  ],
  alternates: {
    canonical: 'https://raaga.me/download',
  },
  openGraph: {
    title: 'Download Raaga App — Android APK (v1.4.0), Windows & Mac',
    description: 'Stream music in 24-bit lossless FLAC. Download the native Android APK (v1.4.0), Windows, and Mac desktop apps.',
    url: 'https://raaga.me/download',
    siteName: 'Raaga',
    images: [
      {
        url: 'https://raaga.me/brand/raagax-banner-logo.png',
        width: 1200,
        height: 630,
        alt: 'Download Raaga Apps for Android, Windows & Mac',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Raaga App — Android APK (v1.4.0), Windows & Mac',
    description: 'Stream music in 24-bit lossless FLAC. Download the native Android APK (v1.4.0), Windows, and Mac desktop apps.',
    images: ['https://raaga.me/brand/raagax-banner-logo.png'],
  },
};

const downloadSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://raaga.me/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Download App',
          item: 'https://raaga.me/download',
        },
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://raaga.me/download#app',
      name: 'RaagaX Mobile & Desktop',
      operatingSystem: 'Android, Windows 10/11, macOS, Web PWA',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'Audio & Music Player',
      softwareVersion: '1.4.0',
      fileSize: '19.9MB',
      downloadUrl: 'https://raaga.me/download',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '12840',
        bestRating: '5',
        worstRating: '1',
      },
    },
  ],
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(downloadSchema) }}
      />
      {children}
    </>
  );
}
