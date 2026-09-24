import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download RaagaX - Free Music App for Android (APK), Windows & Mac',
  description: 'Download RaagaX on Android, Windows, and macOS. Stream unlimited Telugu, Hindi, Tamil and English music with lossless audio, synced lyrics, offline downloads, and background playback.',
  applicationName: 'RaagaX',
  alternates: {
    canonical: 'https://raaga.me/download',
  },
  openGraph: {
    title: 'Download RaagaX - Android APK, Windows & macOS Apps',
    description: 'Stream music in 24-bit lossless FLAC. Download the native Android APK (v1.4.0), Windows, and Mac desktop apps.',
    url: 'https://raaga.me/download',
    siteName: 'RaagaX',
    images: [
      {
        url: 'https://raaga.me/brand/raagax-banner-logo.png',
        width: 1024,
        height: 341,
        alt: 'Download RaagaX Apps',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download RaagaX - Android APK & Desktop Apps',
    description: 'Stream music in 24-bit lossless FLAC. Download the native Android APK (v1.4.0), Windows, and Mac desktop apps.',
    images: ['https://raaga.me/brand/raagax-banner-logo.png'],
  },
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
