import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RAAGAX_CONFIG } from "@/config/release";

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
  title: `${RAAGAX_CONFIG.appName} — Music playback, engineered beyond the surface`,
  description:
    "An independent Android music experience built around immersive playback, high-quality audio, synchronized lyrics, offline listening, real-time listening sessions, and cross-device control.",
  keywords: [
    "RaagaX",
    "Android Music Player",
    "Jetpack Compose",
    "Media3",
    "ExoPlayer",
    "Synchronized Lyrics",
    "Listen Together",
    "Lossless FLAC",
    "C++ NDK Audio Analysis",
    "WebSocket Jam Sessions",
    "Chandra Reddy",
    "Astrionix",
  ],
  authors: [{ name: RAAGAX_CONFIG.authorName, url: RAAGAX_CONFIG.githubRepoUrl }],
  openGraph: {
    title: `${RAAGAX_CONFIG.appName} — An Operating System for Music`,
    description:
      "A cinematic, high-performance Android music player with real-time synchronized playback, lossless audio streaming, and C++ spectral audio engineering.",
    url: RAAGAX_CONFIG.liveDomainUrl,
    siteName: RAAGAX_CONFIG.appName,
    images: [
      {
        url: "/hero_mockup.jpg",
        width: 1200,
        height: 675,
        alt: "RaagaX Flagship Android Music Player Interface",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${RAAGAX_CONFIG.appName} — Music playback, engineered beyond the surface`,
    description:
      "Modern Android music streaming and playback platform engineered by Chandra Reddy (@Astrionix).",
    images: ["/hero_mockup.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${jetbrainsMono.variable} dark scroll-smooth`}>
      <body className="bg-[#04060a] text-zinc-100 antialiased font-sans selection:bg-red-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
