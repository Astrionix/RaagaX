import { create } from 'zustand';
import {
  JamSession,
  JamParticipantState,
  JamPermissions,
  JamQueueItem,
  JamSyncDiagnostics,
  DiscoveredJam,
} from '@/types/jam';
import { Song } from '@/types/music';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { JamDiscoveryEngine } from '@/lib/jam/client/JamDiscoveryEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { useAuthStore } from './useAuthStore';

interface JamState {
  session: JamSession | null;
  participantState: JamParticipantState;
  isInJam: boolean;
  isHost: boolean;
  isJamModalOpen: boolean;
  isShareModalOpen: boolean;
  isAddToJamModalOpen: boolean;
  isDiagnosticsModalOpen: boolean;
  isJoinModalOpen: boolean;
  discoveredJams: DiscoveredJam[];
  isScanningNearby: boolean;
  isLoading: boolean;
  error: string | null;
  diagnostics: JamSyncDiagnostics;

  // Actions
  toggleJamModal: (open?: boolean) => void;
  toggleShareModal: (open?: boolean) => void;
  toggleAddToJamModal: (open?: boolean) => void;
  toggleDiagnosticsModal: (open?: boolean) => void;
  toggleJoinModal: (open?: boolean) => void;

  startNearbyDiscovery: () => void;
  stopNearbyDiscovery: () => void;

  createJam: (params?: { jamName?: string; initialSong?: Song | null; initialQueue?: Song[] }) => Promise<JamSession | null>;
  joinJam: (jamId: string) => Promise<JamSession | null>;
  joinByCode: (code: string) => Promise<JamSession | null>;
  leaveJam: () => Promise<void>;

  sendPlay: (positionMs?: number) => Promise<boolean>;
  sendPause: () => Promise<boolean>;
  sendSeek: (positionMs: number) => Promise<boolean>;
  sendSkipNext: () => Promise<boolean>;
  sendSkipPrev: () => Promise<boolean>;
  sendAddTrack: (song: Song) => Promise<boolean>;
  sendRemoveTrack: (queueItemId: string) => Promise<boolean>;
  sendReorderQueue: (newQueue: JamQueueItem[]) => Promise<boolean>;
  sendUpdatePermissions: (permissions: Partial<JamPermissions>) => Promise<boolean>;
  sendTransferHost: (newHostId: string) => Promise<boolean>;
  sendKickParticipant: (targetUserId: string) => Promise<boolean>;
  sendEndSession: () => Promise<boolean>;

  updateDiagnostics: () => void;
}

export const useJamStore = create<JamState>((set, get) => {
  // Setup subscription to JamClientManager after store initializes
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      const manager = JamClientManager.getInstance();
      manager.subscribe((session, state) => {
        set({
          session,
          participantState: state,
          isInJam: Boolean(session),
          isHost: manager.isHost(),
        });
        if (typeof get().updateDiagnostics === 'function') {
          get().updateDiagnostics();
        }
      });

      // Subscribe to nearby discovery engine
      JamDiscoveryEngine.getInstance().subscribe((jams) => {
        set({ discoveredJams: jams });
      });

      // Update diagnostics regularly
      setInterval(() => {
        if (get().isInJam && typeof get().updateDiagnostics === 'function') {
          get().updateDiagnostics();
        }
      }, 1000);
    });
  }

  return {
    session: null,
    participantState: 'READY',
    isInJam: false,
    isHost: false,
    isJamModalOpen: false,
    isShareModalOpen: false,
    isAddToJamModalOpen: false,
    isDiagnosticsModalOpen: false,
    isJoinModalOpen: false,
    discoveredJams: [],
    isScanningNearby: false,
    isLoading: false,
    error: null,
    diagnostics: {
      clockOffsetMs: 0,
      rttMs: 0,
      jitterMs: 0,
      playbackDriftMs: 0,
      serverTime: 0,
      localTime: 0,
      revision: 0,
      syncState: 'DISCONNECTED',
      estimatedLeadTimeMs: 400,
      bufferSec: 0,
    },

    toggleJamModal: (open) => set((s) => ({ isJamModalOpen: open !== undefined ? open : !s.isJamModalOpen })),
    toggleShareModal: (open) => set((s) => ({ isShareModalOpen: open !== undefined ? open : !s.isShareModalOpen })),
    toggleAddToJamModal: (open) => set((s) => ({ isAddToJamModalOpen: open !== undefined ? open : !s.isAddToJamModalOpen })),
    toggleDiagnosticsModal: (open) => set((s) => ({ isDiagnosticsModalOpen: open !== undefined ? open : !s.isDiagnosticsModalOpen })),
    toggleJoinModal: (open) => {
      const targetState = open !== undefined ? open : !get().isJoinModalOpen;
      set({ isJoinModalOpen: targetState });
      if (targetState) {
        get().startNearbyDiscovery();
      } else {
        get().stopNearbyDiscovery();
      }
    },

    startNearbyDiscovery: () => {
      set({ isScanningNearby: true });
      JamDiscoveryEngine.getInstance().startScanning();
    },

    stopNearbyDiscovery: () => {
      set({ isScanningNearby: false });
      JamDiscoveryEngine.getInstance().stopScanning();
    },

    createJam: async (params) => {
      set({ isLoading: true, error: null });
      try {
        const authUser = useAuthStore.getState().user;
        const manager = JamClientManager.getInstance();

        manager.initUser(
          authUser?.id || `user_${Date.now().toString(36)}`,
          authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'RaagaX Listener',
          authUser?.user_metadata?.avatar_url
        );

        const session = await manager.createJam(params);
        set({
          session,
          isInJam: true,
          isHost: true,
          isLoading: false,
          isJamModalOpen: true,
          isJoinModalOpen: false,
        });
        return session;
      } catch (err: any) {
        set({ isLoading: false, error: err?.message || 'Failed to create Jam' });
        return null;
      }
    },

    joinByCode: async (code: string) => {
      set({ isLoading: true, error: null });
      try {
        const authUser = useAuthStore.getState().user;
        const manager = JamClientManager.getInstance();

        manager.initUser(
          authUser?.id || `user_${Date.now().toString(36)}`,
          authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'RaagaX Listener',
          authUser?.user_metadata?.avatar_url
        );

        const session = await manager.joinByCode(code);
        set({
          session,
          isInJam: true,
          isHost: manager.isHost(),
          isLoading: false,
          isJamModalOpen: true,
          isJoinModalOpen: false,
        });
        return session;
      } catch (err: any) {
        set({ isLoading: false, error: err?.message || 'Failed to join Jam' });
        return null;
      }
    },

    joinJam: async (jamId) => {
      set({ isLoading: true, error: null });
      try {
        const cleanJamId = jamId.trim().toUpperCase();
        const formattedJamId = cleanJamId.startsWith('JAM_') ? cleanJamId : `JAM_${cleanJamId}`;

        const authUser = useAuthStore.getState().user;
        const manager = JamClientManager.getInstance();

        manager.initUser(
          authUser?.id || `user_${Date.now().toString(36)}`,
          authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'RaagaX Listener',
          authUser?.user_metadata?.avatar_url
        );

        const session = await manager.joinJam(formattedJamId);
        set({
          session,
          isInJam: true,
          isHost: manager.isHost(),
          isLoading: false,
          isJamModalOpen: true,
          isJoinModalOpen: false,
        });
        return session;
      } catch (err: any) {
        set({ isLoading: false, error: err?.message || 'Failed to join Jam' });
        return null;
      }
    },

    leaveJam: async () => {
      set({ isLoading: true });
      try {
        await JamClientManager.getInstance().leaveJam();
        set({
          session: null,
          isInJam: false,
          isHost: false,
          isJamModalOpen: false,
          isLoading: false,
        });
      } catch (err: any) {
        set({ isLoading: false, error: err?.message || 'Failed to leave Jam' });
      }
    },

    sendPlay: async (positionMs) => {
      return JamClientManager.getInstance().sendPlay(positionMs);
    },

    sendPause: async () => {
      return JamClientManager.getInstance().sendPause();
    },

    sendSeek: async (positionMs) => {
      return JamClientManager.getInstance().sendSeek(positionMs);
    },

    sendSkipNext: async () => {
      return JamClientManager.getInstance().sendSkipNext();
    },

    sendSkipPrev: async () => {
      return JamClientManager.getInstance().sendSkipPrev();
    },

    sendAddTrack: async (song) => {
      return JamClientManager.getInstance().sendAddTrack(song);
    },

    sendRemoveTrack: async (queueItemId) => {
      return JamClientManager.getInstance().sendRemoveTrack(queueItemId);
    },

    sendReorderQueue: async (newQueue) => {
      return JamClientManager.getInstance().sendReorderQueue(newQueue);
    },

    sendUpdatePermissions: async (permissions) => {
      return JamClientManager.getInstance().sendUpdatePermissions(permissions);
    },

    sendTransferHost: async (newHostId) => {
      return JamClientManager.getInstance().sendTransferHost(newHostId);
    },

    sendKickParticipant: async (targetUserId) => {
      return JamClientManager.getInstance().sendKickParticipant(targetUserId);
    },

    sendEndSession: async () => {
      const ok = await JamClientManager.getInstance().sendEndSession();
      if (ok) {
        set({
          session: null,
          isInJam: false,
          isHost: false,
          isJamModalOpen: false,
        });
      }
      return ok;
    },

    updateDiagnostics: () => {
      const clock = ClockSyncEngine.getInstance().getState();
      const drift = DriftCorrectionEngine.getInstance().getPlaybackDriftMs();
      const session = get().session;
      const participantState = get().participantState;

      let syncState: JamSyncDiagnostics['syncState'] = 'DISCONNECTED';
      if (!session) {
        syncState = 'DISCONNECTED';
      } else if (participantState === 'RECONNECTING') {
        syncState = 'RECONNECTING';
      } else if (participantState === 'SYNCING' || participantState === 'BUFFERING' || participantState === 'JOINING') {
        syncState = 'SYNCHRONIZING';
      } else {
        syncState = 'SYNCHRONIZED';
      }

      set({
        diagnostics: {
          clockOffsetMs: clock.offsetMs,
          rttMs: clock.rttMs,
          jitterMs: clock.jitterMs,
          playbackDriftMs: drift,
          serverTime: Date.now() + clock.offsetMs,
          localTime: Date.now(),
          revision: session?.revision || 0,
          syncState,
          estimatedLeadTimeMs: session?.leadTimeMs || 400,
          bufferSec: 3.5,
        },
      });
    },
  };
});
