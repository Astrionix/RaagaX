'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PlayerBar } from '@/components/layout/Navbar';
import { RightQueuePanel } from '@/components/layout/RightQueuePanel';
import { MobileBottomController } from '@/components/layout/MobileBottomController';
import { AudioPlayerController } from '@/components/player/AudioPlayerController';
import { LyricsPanel } from '@/components/lyrics/LyricsPanel';
import { QueueModal } from '@/components/player/QueueModal';
import { ExpandedPlayerModal } from '@/components/player/ExpandedPlayerModal';
import { LockScreenPlayerModal } from '@/components/player/LockScreenPlayerModal';
import { NotificationBarPlayerModal } from '@/components/player/NotificationBarPlayerModal';
import { SystemSurfacesModal } from '@/components/player/SystemSurfacesModal';
import { PlaylistImporterModal } from '@/components/modals/PlaylistImporterModal';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { SleepTimerModal } from '@/components/modals/SleepTimerModal';
import { CastModal } from '@/components/modals/CastModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ContextMenuModal } from '@/components/modals/ContextMenuModal';
import { OnboardingAuthModal } from '@/components/modals/OnboardingAuthModal';
import { KeyboardShortcutsModal } from '@/components/modals/KeyboardShortcutsModal';
import { OfflineStorageSetupModal } from '@/components/modals/OfflineStorageSetupModal';
import { PermissionOnboardingModal } from '@/components/onboarding/PermissionOnboardingModal';
import { LanguageOnboardingModal } from '@/components/onboarding/LanguageOnboardingModal';
import { UpdateModal } from '@/components/modals/UpdateModal';

import { CreatePlaylistModal } from '@/components/modals/CreatePlaylistModal';
import { NotificationCenterModal } from '@/components/modals/NotificationCenterModal';
import { WrappedModal } from '@/components/modals/WrappedModal';
import { CarModeModal } from '@/components/modals/CarModeModal';
import { JamModal } from '@/components/jam/JamModal';
import { JamShareModal } from '@/components/jam/JamShareModal';
import { AddToJamModal } from '@/components/jam/AddToJamModal';
import { JoinJamModal } from '@/components/jam/JoinJamModal';
import { JamDevSyncPanel } from '@/components/jam/JamDevSyncPanel';

import { Toast } from '@/components/ui/Toast';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

import { HomeView } from '@/components/views/HomeView';
import { NewView } from '@/components/views/NewView';
import { SearchView } from '@/components/views/SearchView';
import { LibraryView } from '@/components/views/LibraryView';
import { GenresView } from '@/components/views/GenresView';
import { PlaylistDetailView } from '@/components/views/PlaylistDetailView';
import { AlbumDetailView } from '@/components/views/AlbumDetailView';
import { AlbumsView } from '@/components/views/AlbumsView';
import { ArtistDetailView } from '@/components/views/ArtistDetailView';
import { ArtistsView } from '@/components/views/ArtistsView';
import { ProfileView } from '@/components/views/ProfileView';
import { DownloadsView } from '@/components/views/DownloadsView';
import { FavoritesView } from '@/components/views/FavoritesView';
import { SettingsView } from '@/components/views/SettingsView';
import { InsightsView } from '@/components/views/InsightsView';
import { RecapHistoryView } from '@/components/views/RecapHistoryView';
import { HistoryView } from '@/components/views/HistoryView';
import { SplashScreen } from '@/components/modals/SplashScreen';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

import { useGlobalKeyboardShortcuts } from '@/hooks/useGlobalKeyboardShortcuts';

export default function Page() {
  const {
    activeTab,
    selectedArtistId,
    selectedAlbumId,
    rightPanelMode,
    isQueueOpen,
    isWrappedModalOpen,
    toggleWrappedModal,
    isEqualizerOpen,
    toggleEqualizer,
    isCarModeOpen,
    toggleCarMode,
    isLockScreenOpen,
    toggleLockScreen,
    isNotificationShadeOpen,
    toggleNotificationShade,
    isSystemSurfacesOpen,
    toggleSystemSurfaces
  } = usePlayerStore();
  const { isSetupModalOpen, setSetupModalOpen } = useDownloadStore();

  React.useEffect(() => {
    useAuthStore.getState().initializeAuth();

    // Check for Jam join URL parameter (?jam=JAM_123456)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const jamParam = urlParams.get('jam');
      if (jamParam) {
        // Clean URL so refresh doesn't replay expired invite
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        import('@/context/useJamStore').then(({ useJamStore }) => {
          useJamStore.getState().joinJam(jamParam).catch(() => {});
        });
      }
    }
  }, []);

  // ── Global keyboard shortcuts (Space = play/pause, arrows = seek/volume, etc.)
  // Registered exactly once at the app root via AbortController — never duplicated.
  useGlobalKeyboardShortcuts();

  // Android Predictive Back Gesture & Navigation Hierarchy
  React.useEffect(() => {
    let appBackButtonListener: any = null;

    const handleBackNavigation = () => {
      const store = usePlayerStore.getState();

      // 1. If Settings modal is open, close it
      if (store.isSettingsModalOpen) {
        store.toggleSettingsModal();
        return true;
      }

      // 3. Delegate to NavigationStack for authoritative navigation & player restoration
      const handled = NavigationStack.getInstance().goBack((target) => {
        usePlayerStore.setState({
          activeTab: target.activeTab,
          selectedAlbumId: target.selectedAlbumId,
          selectedArtistId: target.selectedArtistId,
          selectedPlaylistId: target.selectedPlaylistId,
          isPlayerExpanded: target.isPlayerExpanded,
        });
        import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
      });

      if (handled) return true;

      // 4. Fallback: If on any secondary tab, navigate to Home
      if (store.activeTab !== 'home') {
        store.setSelectedAlbumId(null);
        store.setSelectedArtistId(null);
        store.setSelectedPlaylistId(null);
        store.setActiveTab('home');
        import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
        return true;
      }

      return false; // Already on Home at root -> standard app minimize/exit
    };

    const handlePopState = (e: PopStateEvent) => {
      const handled = handleBackNavigation();
      if (!handled && e.state && e.state.tab) {
        usePlayerStore.getState().setActiveTab(e.state.tab);
      }
    };

    // Listen to native Android back button event via Capacitor App plugin if available
    let isMounted = true;
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
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
        }).catch(() => { });
      } catch { }
    }

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
        } catch { }
      }
    };
  }, []);

  // Initialize and Hydrate Global Download Store & Offline Physical Media Sync
  React.useEffect(() => {
    useDownloadStore.getState().hydrate();
  }, []);

  return (
    <div className="min-h-screen w-full max-w-[100vw] bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:flex-row md:h-screen md:overflow-hidden selection:bg-[#EF233C] selection:text-white transition-colors duration-300">
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

      {/* Car / Driving Mode */}
      <CarModeModal
        isOpen={isCarModeOpen}
        onClose={() => toggleCarMode(false)}
      />

      {/* Sidebar Navigation (Desktop Pane 1) */}
      <Sidebar />

      {/* App Layout (Grid after Sidebar) */}
      <div className="flex-1 ml-0 md:ml-64 flex flex-col min-w-0 md:h-screen md:overflow-hidden">
        <div className={`grid flex-1 min-h-0 md:h-full transition-all duration-300 ${
          isQueueOpen && !(activeTab === 'album' || activeTab === 'playlist' || (activeTab === 'artist' && selectedArtistId))
            ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]'
            : 'grid-cols-1'
        }`}>
          {/* Main Content Column */}
          <div className="main-content min-w-0 flex-1 flex flex-col md:h-full md:overflow-y-auto md:overflow-x-hidden relative">
            {/* Header Bar */}
            <Header />

            {/* View Switcher Container */}
            <main className={`flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-[5.5rem] ${
              activeTab === 'album' || activeTab === 'playlist' || (activeTab === 'artist' && selectedArtistId)
                ? 'pt-0 px-0'
                : 'pt-14 md:pt-4 px-3.5 sm:px-8'
            }`}>
              {activeTab === 'home' && <HomeView />}
              {activeTab === 'new' && <NewView />}
              {activeTab === 'search' && <SearchView />}
              {activeTab === 'library' && <LibraryView />}
              {activeTab === 'genres' && <GenresView />}
              {activeTab === 'artist' && (selectedArtistId ? <ArtistDetailView /> : <ArtistsView />)}
              {activeTab === 'album' && (selectedAlbumId ? <AlbumDetailView /> : <AlbumsView />)}
              {activeTab === 'playlist' && <PlaylistDetailView />}
              {activeTab === 'profile' && <ProfileView />}
              {activeTab === 'downloads' && <DownloadsView />}
              {activeTab === 'favorites' && <FavoritesView />}
              {activeTab === 'insights' && <InsightsView />}
              {activeTab === 'recaps' && <RecapHistoryView />}
              {activeTab === 'history' && <HistoryView />}
              {activeTab === 'settings' && <SettingsView />}
            </main>

            {/* Unified Global Scroll-Aware Mobile Bottom Controller */}
            <MobileBottomController />
          </div>

          {/* Right Queue Column (Toggled on desktop when isQueueOpen is true) */}
          {isQueueOpen && (
            <div className="queue-panel hidden xl:block w-[360px] min-w-[360px] h-full pt-6 pb-8 overflow-y-auto overflow-x-hidden border-l border-white/[0.04] bg-[var(--bg-secondary)] animate-in slide-in-from-right-4 duration-200">
              <RightQueuePanel />
            </div>
          )}
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
      <ErrorBoundary name="UpdateModal">
        <UpdateModal />
      </ErrorBoundary>

      {/* ── Remote Jam Party Modals ── */}
      <ErrorBoundary name="JamModal">
        <JamModal />
      </ErrorBoundary>
      <ErrorBoundary name="JamShareModal">
        <JamShareModal />
      </ErrorBoundary>
      <ErrorBoundary name="AddToJamModal">
        <AddToJamModal />
      </ErrorBoundary>
      <ErrorBoundary name="JoinJamModal">
        <JoinJamModal />
      </ErrorBoundary>
      <JamDevSyncPanel />

      {/* ── Native Android Connected Surfaces ── */}
      <LockScreenPlayerModal
        isOpen={isLockScreenOpen}
        onClose={() => toggleLockScreen(false)}
      />
      <NotificationBarPlayerModal
        isOpen={isNotificationShadeOpen}
        onClose={() => toggleNotificationShade(false)}
      />
      <SystemSurfacesModal
        isOpen={isSystemSurfacesOpen}
        onClose={() => toggleSystemSurfaces(false)}
        onOpenLockScreen={() => toggleLockScreen(true)}
        onOpenNotificationShade={() => toggleNotificationShade(true)}
      />
    </div>
  );
}
