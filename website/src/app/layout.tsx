import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RAAGAX_CONFIG } from "@/config/release";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#04060a",
};

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(RAAGAX_CONFIG.liveDomainUrl),
  title: `${RAAGAX_CONFIG.appName} — Your Music. Without Limits.`,
  description:
    "Your Music. Without Limits. An independent, bit-perfect music playback platform for Android and Desktop built around immersive listening, synchronized lyrics, and lossless FLAC streams.",
  icons: {
    icon: "/app_icon.png",
    shortcut: "/app_icon.png",
    apple: "/app_icon.png",
  },
  keywords: [
    "Raaga",
    "Raaga Music",
    "Android Music Player",
    "Compose Multiplatform",
    "Media3",
    "ExoPlayer",
    "Synchronized Lyrics",
    "Lossless FLAC",
    "C++ NDK Audio Engine",
    "Chandra Reddy",
    "Astrionix",
  ],
  authors: [{ name: RAAGAX_CONFIG.authorName, url: RAAGAX_CONFIG.liveDomainUrl }],
  openGraph: {
    title: `${RAAGAX_CONFIG.appName} — Your Music. Without Limits.`,
    description:
      "Your Music. Without Limits. A cinematic, high-performance music player with real-time synchronized lyrics and lossless audio streaming.",
    url: RAAGAX_CONFIG.liveDomainUrl,
    siteName: RAAGAX_CONFIG.appName,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${RAAGAX_CONFIG.appName} — Your Music. Without Limits.`,
    description:
      "Your Music. Without Limits. Modern music streaming and playback platform engineered by Chandra Reddy (@Astrionix).",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakartaSans.variable} ${jetbrainsMono.variable} dark scroll-smooth`}>
      <body suppressHydrationWarning className="bg-[#04060a] text-zinc-100 antialiased font-sans selection:bg-red-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
