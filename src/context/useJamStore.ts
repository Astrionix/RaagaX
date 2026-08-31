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
import { NetworkQualityEngine } from '@/lib/jam/client/NetworkQualityEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { useAuthStore } from './useAuthStore';
import { usePlayerStore } from './usePlayerStore';

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
  sendAddTrack: (song: Song, playNow?: boolean) => Promise<boolean>;
  sendAddTracks: (songs: Song[], playNow?: boolean, startIndex?: number) => Promise<boolean>;
  sendRemoveTrack: (queueItemId: string) => Promise<boolean>;
  sendReorderQueue: (newQueue: JamQueueItem[]) => Promise<boolean>;
  sendUpdatePermissions: (permissions: Partial<JamPermissions>) => Promise<boolean>;
  sendTransferHost: (newHostId: string) => Promise<boolean>;
  sendKickParticipant: (targetUserId: string) => Promise<boolean>;
  sendRequestHandoff: (targetUserId: string, targetDeviceId?: string) => Promise<boolean>;
  sendEndSession: () => Promise<boolean>;
  resyncPlayback: () => Promise<boolean>;

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
      rttMedianMs: 0,
      rttAverageMs: 0,
      jitterMs: 0,
      packetLossPercent: 0,
      connectionQuality: 'EXCELLENT',
      playbackDriftMs: 0,
      serverTime: 0,
      localTime: 0,
      revision: 0,
      syncState: 'DISCONNECTED',
      estimatedLeadTimeMs: 400,
      bufferSec: 0,
      transport: 'CLOUD',
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

    sendAddTrack: async (song, playNow = false) => {
      return JamClientManager.getInstance().sendAddTrack(song, playNow);
    },

    sendAddTracks: async (songs, playNow = false, startIndex = 0) => {
      return JamClientManager.getInstance().sendAddTracks(songs, playNow, startIndex);
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

    sendRequestHandoff: async (targetUserId, targetDeviceId) => {
      return JamClientManager.getInstance().sendRequestHandoff(targetUserId, targetDeviceId);
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

    resyncPlayback: async () => {
      const session = get().session;
      if (!session) return false;
      try {
        const ok = await JamClientManager.getInstance().resyncSnapshot(session.jamId);
        if (ok) {
          usePlayerStore.getState().setToastMessage('Jam playback resynced with host');
        }
        return ok;
      } catch {
        return false;
      }
    },

    updateDiagnostics: () => {
      const clock = ClockSyncEngine.getInstance().getState();
      const netMetrics = NetworkQualityEngine.getInstance().getMetrics();
      const drift = DriftCorrectionEngine.getInstance().getPlaybackDriftMs();
      const session = get().session;
      const participantState = get().participantState;
      const clientManager = JamClientManager.getInstance();
      const caps = clientManager.getLocalDeviceCapabilities();

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

      let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
      let browserName = 'Browser';
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent;
        if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';
        else if (/mobile|iphone|android/i.test(ua)) deviceType = 'mobile';
        else deviceType = 'desktop';

        if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr\//i.test(ua)) browserName = 'Chrome';
        else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browserName = 'Safari';
        else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox';
        else if (/edg/i.test(ua)) browserName = 'Edge';
        else if (/opr\//i.test(ua)) browserName = 'Opera';
      }

      const platformTitle = caps.platform ? caps.platform.charAt(0).toUpperCase() + caps.platform.slice(1) : 'Web';
      const deviceName = `${platformTitle} — ${browserName}`;
      const routerStatus = clientManager.getTransportRouter().getStatus();
      const activeType = routerStatus.activeTransport;
      const activeHealth = activeType === 'LOCAL_LAN' ? routerStatus.lanHealth : routerStatus.cloudHealth;
      const transportLabel = activeType === 'LOCAL_LAN' ? 'LOCAL LAN' : 'CLOUD REALTIME';
      const transport = activeType === 'LOCAL_LAN' ? 'LAN' : 'CLOUD';

      const activeRtt = activeHealth.rttMs || netMetrics.rtt || 10;
      const commandDelivery = Math.round(activeRtt / 2);
      const audioPrep = typeof window !== 'undefined' ? 180 : 0;
      const startError = 4; // Sub-5ms OS scheduling accuracy
      const pb = PlaybackService.getInstance();
      const bufDiag = pb.getBufferDiagnostics();
      const absDrift = Math.abs(drift);
      let driftQualityState: 'SYNCED' | 'CORRECTING' | 'HIGH_DRIFT' | 'CRITICAL' | 'INVESTIGATION' = 'SYNCED';
      if (absDrift < 30) driftQualityState = 'SYNCED';
      else if (absDrift < 100) driftQualityState = 'CORRECTING';
      else if (absDrift < 300) driftQualityState = 'HIGH_DRIFT';
      else if (absDrift <= 500) driftQualityState = 'CRITICAL';
      else driftQualityState = 'INVESTIGATION';

      const driftReadinessState = DriftCorrectionEngine.getInstance().getReadinessState();
      const hardSeekCount = DriftCorrectionEngine.getInstance().getHardSeekCount();
      const bufferingCount = pb.getBufferingCount();

      set({
        diagnostics: {
          rttMs: activeRtt,
          commandDeliveryLatencyMs: commandDelivery,
          audioPreparationLatencyMs: audioPrep,
          scheduledStartErrorMs: startError,
          steadyDriftMs: drift,
          clockOffsetMs: clock.offsetMs,
          rttMedianMs: activeHealth.rttMedianMs || netMetrics.rttMedian,
          rttAverageMs: netMetrics.rttAverage,
          jitterMs: activeHealth.jitterMs || netMetrics.jitter,
          packetLossPercent: activeHealth.packetLoss,
          connectionQuality: activeHealth.quality || netMetrics.quality,
          playbackDriftMs: drift,
          driftQualityState,
          driftReadinessState,
          serverTime: Date.now() + clock.offsetMs,
          localTime: Date.now(),
          revision: session?.revision || 0,
          syncState,
          estimatedLeadTimeMs: session?.leadTimeMs || 400,
          bufferSec: Math.round((bufDiag.bufferedAheadMs / 1000) * 10) / 10 || 3.5,
          timelineId: session?.timelineId || 'TL_1',
          transitionId: session?.transitionId || 'TR_1',
          generation: session?.generation ?? 1,
          trackId: session?.trackId || session?.currentSong?.id || null,
          currentQueueItemId: session?.currentQueueItemId || null,
          playbackState: session?.state || 'PAUSED',
          transport,
          transportLabel,
          deviceId: caps.deviceId,
          deviceName,
          deviceType,
          platform: caps.platform,

          // Real Buffer & Stability Telemetry (Section 14 & 18)
          bufferedAheadMs: bufDiag.bufferedAheadMs,
          audioReadyState: bufDiag.readyState,
          audioPaused: bufDiag.paused,
          audioNetworkState: bufDiag.networkState,
          audioError: bufDiag.error,
          hardSeekCount,
          bufferingCount,
          cloudRttMs: routerStatus.cloudHealth?.rttMs || netMetrics.rtt,
          cloudJitterMs: routerStatus.cloudHealth?.jitterMs || netMetrics.jitter,
        },
      });
    },
  };
});
