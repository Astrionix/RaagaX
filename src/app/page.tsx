'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { RightQueuePanel } from '@/components/layout/RightQueuePanel';
import { RightDeviceConnectPanel } from '@/components/layout/RightDeviceConnectPanel';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileMiniPlayer } from '@/components/layout/MobileMiniPlayer';
import { AudioPlayerController } from '@/components/player/AudioPlayerController';
import { LyricsPanel } from '@/components/player/LyricsPanel';
import { QueueModal } from '@/components/player/QueueModal';
import { ExpandedPlayerModal } from '@/components/player/ExpandedPlayerModal';
import { PlaylistImporterModal } from '@/components/modals/PlaylistImporterModal';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { SleepTimerModal } from '@/components/modals/SleepTimerModal';
import { CastModal } from '@/components/modals/CastModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ContextMenuModal } from '@/components/modals/ContextMenuModal';
import { OnboardingAuthModal } from '@/components/modals/OnboardingAuthModal';
import { KeyboardShortcutsModal } from '@/components/modals/KeyboardShortcutsModal';
import { MobileDeviceConnectModal } from '@/components/modals/MobileDeviceConnectModal';
import { RemoteDeviceBanner } from '@/components/player/RemoteDeviceBanner';

import { HomeView } from '@/components/views/HomeView';
import { SearchView } from '@/components/views/SearchView';
import { LibraryView } from '@/components/views/LibraryView';
import { PlaylistDetailView } from '@/components/views/PlaylistDetailView';
import { RadioView } from '@/components/views/RadioView';
import { ArtistDetailView } from '@/components/views/ArtistDetailView';
import { ProfileView } from '@/components/views/ProfileView';
import { DownloadsView } from '@/components/views/DownloadsView';
import { FavoritesView } from '@/components/views/FavoritesView';
import { SplashScreen } from '@/components/modals/SplashScreen';

import { usePlayerStore } from '@/context/usePlayerStore';

export default function Page() {
  const { activeTab, rightPanelMode } = usePlayerStore();

  // Sync activeTab to browser history for mobile back gesture support
  React.useEffect(() => {
    if (window.location.hash !== `#${activeTab}`) {
      window.history.pushState({ tab: activeTab }, '', `#${activeTab}`);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        usePlayerStore.getState().setActiveTab(e.state.tab);
      } else {
        usePlayerStore.getState().setActiveTab('home');
      }
    };

    // Initialize state if not present
    if (!window.history.state?.tab) {
      window.history.replaceState({ tab: usePlayerStore.getState().activeTab }, '', `#${usePlayerStore.getState().activeTab}`);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#07090E] text-white flex selection:bg-[#EF233C] selection:text-white transition-colors duration-300">
      {/* Audio Engine Controller */}
      <AudioPlayerController />
      <RemoteDeviceBanner />

      {/* Splash Screen Animation */}
      <SplashScreen />

      {/* Sidebar Navigation (Desktop Pane 1) */}
      <Sidebar />

      {/* App Layout (Grid after Sidebar) */}
      <div className="flex-1 ml-0 md:ml-64 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] min-h-screen transition-all duration-300 h-screen overflow-hidden">
        
        {/* Main Content Column */}
        <div className="main-content min-w-0 min-h-0 overflow-y-auto overflow-x-hidden relative flex flex-col h-full">
          {/* Top Navbar */}
          <Navbar />

          {/* View Switcher Container */}
          <main className="flex-1 pt-24 pb-48 md:pb-8 px-4 sm:px-8">
            {activeTab === 'home' && <HomeView />}
            {activeTab === 'search' && <SearchView />}
            {activeTab === 'library' && <LibraryView />}
            {activeTab === 'radio' && <RadioView />}
            {activeTab === 'artist' && <ArtistDetailView />}
            {activeTab === 'album' && <HomeView />}
            {activeTab === 'playlist' && <PlaylistDetailView />}
            {activeTab === 'profile' && <ProfileView />}
            {activeTab === 'downloads' && <DownloadsView />}
            {activeTab === 'favorites' && <FavoritesView />}
          </main>

          {/* Mobile Navigation & Mini Player */}
          <MobileMiniPlayer />
          <MobileNav />
        </div>

        {/* Right Queue Column */}
        <div className="queue-panel hidden xl:block w-[360px] min-w-[360px] h-full pt-24 pb-8 overflow-y-auto overflow-x-hidden border-l border-white/5 bg-[#07090E]">
          {rightPanelMode === 'devices' ? <RightDeviceConnectPanel /> : <RightQueuePanel />}
        </div>
      </div>

      {/* Full-Screen Overlays & Modals (Root Level Z-50) */}
      <ExpandedPlayerModal />
      <LyricsPanel />
      <QueueModal />
      <PlaylistImporterModal />
      <BackupRestoreModal />
      <SleepTimerModal />
      <CastModal />
      <SettingsModal />
      <ContextMenuModal />
      <OnboardingAuthModal />
      <KeyboardShortcutsModal />
      <MobileDeviceConnectModal />
    </div>
  );
}
