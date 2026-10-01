import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/navigation/Sidebar";
import Navbar from "@/components/navigation/Navbar";
import MobileNav from "@/components/navigation/MobileNav";
import BottomPlayer from "@/components/player/BottomPlayer";
import DesktopRightPanels from "@/components/player/DesktopRightPanels";
import NowPlayingModal from "@/components/player/NowPlayingModal";
import EqualizerModal from "@/components/player/EqualizerModal";
import ConnectModal from "@/components/connect/ConnectModal";
import AuthModal from "@/components/auth/AuthModal";
import PlaylistPickerModal from "@/components/playlist/PlaylistPickerModal";
import AudioEngine from "@/components/audio/AudioEngine";
import ClientInit from "@/components/common/ClientInit";
import { LiquidGlassFilters } from "@/components/common/LiquidGlass";
import AmbientBackground from "@/components/common/AmbientBackground";
import NerdStatsModal from "@/components/common/NerdStatsModal";

export const metadata: Metadata = {
  title: "Raaga Desktop - Liquid Glass Music Experience",
  description:
    "Desktop music player with real YouTube Music catalog, hi-res audio, and transparent Liquid Glass design system.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070709] text-white antialiased overflow-hidden flex h-screen w-screen selection:bg-raaga-red selection:text-white relative">
        {/* Core Audio Engine, Refraction Filters, Dynamic Ambient Canvas & Synchronizers */}
        <AmbientBackground />
        <LiquidGlassFilters />
        <AudioEngine />
        <ClientInit />

        {/* Floating Liquid Glass Sidebar Navigation */}
        <Sidebar />

        {/* Main Floating Desktop Stage */}
        <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden relative">
          <Navbar />
          
          <main id="main-content-viewport" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-2 pb-32 no-scrollbar">
            {children}
          </main>

          {/* Persistent Bottom Audio Player Bar */}
          <BottomPlayer />

          {/* Mobile Bottom Navigation (Hidden on Desktop) */}
          <MobileNav />

          {/* Right Slide-out Panels (Queue & Lyrics) */}
          <DesktopRightPanels />
        </div>

        {/* Modals & Fullscreen Overlays */}
        <NowPlayingModal />
        <EqualizerModal />
        <ConnectModal />
        <AuthModal />
        <PlaylistPickerModal />
        <NerdStatsModal />
      </body>
    </html>
  );
}
