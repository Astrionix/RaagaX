'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PlayerBar } from '@/components/layout/Navbar';
import { RightQueuePanel } from '@/components/layout/RightQueuePanel';
import { RightDeviceConnectPanel } from '@/components/layout/RightDeviceConnectPanel';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileMiniPlayer } from '@/components/layout/MobileMiniPlayer';
import { AudioPlayerController } from '@/components/player/AudioPlayerController';
import { LyricsPanel } from '@/components/lyrics/LyricsPanel';
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
import { OfflineStorageSetupModal } from '@/components/modals/OfflineStorageSetupModal';
import { PermissionOnboardingModal } from '@/components/onboarding/PermissionOnboardingModal';
import { LanguageOnboardingModal } from '@/components/onboarding/LanguageOnboardingModal';

import { CreatePlaylistModal } from '@/components/modals/CreatePlaylistModal';
import { NotificationCenterModal } from '@/components/modals/NotificationCenterModal';
import { WrappedModal } from '@/components/modals/WrappedModal';
import { EqualizerModal } from '@/components/modals/EqualizerModal';
import { CarModeModal } from '@/components/modals/CarModeModal';

import { Toast } from '@/components/ui/Toast';

import { HomeView } from '@/components/views/HomeView';
import { SearchView } from '@/components/views/SearchView';
import { LibraryView } from '@/components/views/LibraryView';
import { PlaylistDetailView } from '@/components/views/PlaylistDetailView';
import { AlbumDetailView } from '@/components/views/AlbumDetailView';
import { RadioView } from '@/components/views/RadioView';
import { ArtistDetailView } from '@/components/views/ArtistDetailView';
import { ArtistsView } from '@/components/views/ArtistsView';
import { ProfileView } from '@/components/views/ProfileView';
import { DownloadsView } from '@/components/views/DownloadsView';
import { FavoritesView } from '@/components/views/FavoritesView';
import { SettingsView } from '@/components/views/SettingsView';
import { InsightsView } from '@/components/views/InsightsView';
import { RecapHistoryView } from '@/components/views/RecapHistoryView';
import { SplashScreen } from '@/components/modals/SplashScreen';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';

export default function Page() {
  const { 
    activeTab, 
    selectedArtistId, 
    rightPanelMode,
    isWrappedModalOpen,
    toggleWrappedModal,
    isEqualizerOpen,
    toggleEqualizer,
    isCarModeOpen,
    toggleCarMode
  } = usePlayerStore();
  const { isSetupModalOpen, setSetupModalOpen } = useDownloadStore();

  // Android Predictive Back Gesture & Navigation Hierarchy
  React.useEffect(() => {
    let appBackButtonListener: any = null;

    const handleBackNavigation = () => {
      const store = usePlayerStore.getState();

      // 1. If Full Player modal is expanded, collapse it first
      if (store.isPlayerExpanded) {
        usePlayerStore.setState({ isPlayerExpanded: false });
        import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
        return true;
      }

      // 2. If Settings modal is open, close it
      if (store.isSettingsModalOpen) {
        store.toggleSettingsModal();
        return true;
      }

      // 3. If Device Connect modal is open, close it
      if (store.isDeviceModalOpen) {
        store.toggleDeviceModal();
        return true;
      }

      // 4. If on any detail view / secondary tab (browse, search, library, profile, artist, album, playlist, downloads, etc.), navigate back to Home
      if (store.activeTab !== 'home') {
        store.setActiveTab('home');
        import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
        return true;
      }

      return false; // Already on Home with no modals open -> standard app minimize/exit
    };

    const handlePopState = (e: PopStateEvent) => {
      const handled = handleBackNavigation();
      if (!handled && e.state && e.state.tab) {
        usePlayerStore.getState().setActiveTab(e.state.tab);
      }
    };

    // Listen to native Android back button event via Capacitor App plugin if available
    let isMounted = true;
    try {
      import('@capacitor/app').then(async ({ App }) => {
        if (!isMounted) return;
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          const handled = handleBackNavigation();
          if (!handled) {
            App.exitApp();
          }
        });
        if (!isMounted) {
          handle?.remove?.();
        } else {
          appBackButtonListener = handle;
        }
      }).catch(() => {});
    } catch {}

    window.addEventListener('popstate', handlePopState);
    return () => {
      isMounted = false;
      window.removeEventListener('popstate', handlePopState);
      if (appBackButtonListener) {
        try {
          if (typeof appBackButtonListener.remove === 'function') {
            appBackButtonListener.remove();
          } else if (typeof appBackButtonListener.then === 'function') {
            appBackButtonListener.then((h: any) => h?.remove?.());
          }
        } catch {}
      }
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] flex selection:bg-[#EF233C] selection:text-white transition-colors duration-300">
      {/* Audio Engine Controller */}
      <AudioPlayerController />


      {/* Splash Screen Animation */}
      <SplashScreen />
      <Toast />
      
      <OfflineStorageSetupModal 
        isOpen={isSetupModalOpen} 
        onClose={() => setSetupModalOpen(false)} 
        onComplete={() => setSetupModalOpen(false)} 
      />

      {/* RaagaX 2026 Wrapped Experience */}
      <WrappedModal
        isOpen={isWrappedModalOpen}
        onClose={() => toggleWrappedModal(false)}
        year={2026}
      />

      {/* Pro Audio Equalizer & Spatial Audio */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => toggleEqualizer(false)}
      />

      {/* Car / Driving Mode */}
      <CarModeModal
        isOpen={isCarModeOpen}
        onClose={() => toggleCarMode(false)}
      />

      {/* Sidebar Navigation (Desktop Pane 1) */}
      <Sidebar />

      {/* App Layout (Grid after Sidebar) */}
      <div className="flex-1 ml-0 md:ml-64 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] md:h-[calc(100vh-5rem)] overflow-hidden">
        
        {/* Main Content Column */}
        <div className="main-content min-w-0 min-h-0 overflow-y-auto overflow-x-hidden relative flex flex-col h-full">
          {/* Header Bar */}
          <Header />

          {/* View Switcher Container */}
          <main className="flex-1 pt-14 md:pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-8 px-3.5 sm:px-8">
            {activeTab === 'home' && <HomeView />}
            {activeTab === 'search' && <SearchView />}
            {activeTab === 'library' && <LibraryView />}
            {activeTab === 'radio' && <RadioView />}
            {activeTab === 'artist' && (selectedArtistId ? <ArtistDetailView /> : <ArtistsView />)}
            {activeTab === 'album' && <AlbumDetailView />}
            {activeTab === 'playlist' && <PlaylistDetailView />}
            {activeTab === 'profile' && <ProfileView />}
            {activeTab === 'downloads' && <DownloadsView />}
            {activeTab === 'favorites' && <FavoritesView />}
            {activeTab === 'insights' && <InsightsView />}
            {activeTab === 'recaps' && <RecapHistoryView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>

          {/* Mobile Navigation & Mini Player */}
          <MobileMiniPlayer />
          <MobileNav />
        </div>

        {/* Right Queue Column */}
        <div className="queue-panel hidden xl:block w-[360px] min-w-[360px] h-full pt-6 pb-8 overflow-y-auto overflow-x-hidden border-l border-white/5 bg-[#07090E]">
          {rightPanelMode === 'devices' ? <RightDeviceConnectPanel /> : <RightQueuePanel />}
        </div>
      </div>

      {/* Desktop Persistent Bottom Audio Player Bar */}
      <PlayerBar />

      {/* Full-Screen Overlays & Modals (Root Level Z-50) */}
      <ErrorBoundary name="ExpandedPlayerModal">
        <ExpandedPlayerModal />
      </ErrorBoundary>
      <ErrorBoundary name="LyricsPanel">
        <LyricsPanel />
      </ErrorBoundary>
      <ErrorBoundary name="QueueModal">
        <QueueModal />
      </ErrorBoundary>
      <ErrorBoundary name="PlaylistImporterModal">
        <PlaylistImporterModal />
      </ErrorBoundary>
      <ErrorBoundary name="BackupRestoreModal">
        <BackupRestoreModal />
      </ErrorBoundary>
      <ErrorBoundary name="SleepTimerModal">
        <SleepTimerModal />
      </ErrorBoundary>
      <ErrorBoundary name="CastModal">
        <CastModal />
      </ErrorBoundary>
      <ErrorBoundary name="SettingsModal">
        <SettingsModal />
      </ErrorBoundary>
      <ErrorBoundary name="ContextMenuModal">
        <ContextMenuModal />
      </ErrorBoundary>
      <ErrorBoundary name="OnboardingAuthModal">
        <OnboardingAuthModal />
      </ErrorBoundary>
      <ErrorBoundary name="KeyboardShortcutsModal">
        <KeyboardShortcutsModal />
      </ErrorBoundary>
      <ErrorBoundary name="MobileDeviceConnectModal">
        <MobileDeviceConnectModal />
      </ErrorBoundary>
      <ErrorBoundary name="CreatePlaylistModal">
        <CreatePlaylistModal />
      </ErrorBoundary>
      <ErrorBoundary name="PermissionOnboardingModal">
        <PermissionOnboardingModal />
      </ErrorBoundary>
      <ErrorBoundary name="LanguageOnboardingModal">
        <LanguageOnboardingModal />
      </ErrorBoundary>
      <ErrorBoundary name="NotificationCenterModal">
        <NotificationCenterModal />
      </ErrorBoundary>
    </div>
  );
}
