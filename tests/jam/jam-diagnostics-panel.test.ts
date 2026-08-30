import { describe, it, expect, beforeEach } from 'vitest';
import { useJamStore } from '@/context/useJamStore';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'TRK_123',
  title: 'Pehla Nasha',
  artist: 'Udit Narayan',
  duration: 270,
  audioUrl: 'https://cdn.example.com/pehla_nasha.mp3',
  coverUrl: 'https://cdn.example.com/pehla_nasha.jpg',
};

describe('RaagaX Jam — Advanced Network & Playback Sync Diagnostic Panel Suite', () => {
  beforeEach(() => {
    JamServerEngine.getInstance().resetForTesting();
    JamClientManager.getInstance().resetForTesting();
  });

  it('1. Computes all required existing metrics, device information, and playback diagnostics in useJamStore', () => {
    const server = JamServerEngine.getInstance();
    const { session } = server.createSession({
      hostId: 'user_host_1',
      hostName: 'Test Host',
      initialSong: mockSong,
    });

    // Advance generation and timeline
    server.executeCommand({
      commandId: 'cmd_play_1',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
      payload: { positionMs: 30000 },
    });

    const updatedSession = server.getSession(session.jamId);
    expect(updatedSession).toBeDefined();

    // Set state in store
    useJamStore.setState({
      session: updatedSession,
      isInJam: true,
      participantState: 'PLAYING',
    });

    // Trigger updateDiagnostics
    useJamStore.getState().updateDiagnostics();
    const diag = useJamStore.getState().diagnostics;

    // 1. Existing metrics verification
    expect(diag).toBeDefined();
    expect(diag.connectionQuality).toBeDefined();
    expect(typeof diag.clockOffsetMs).toBe('number');
    expect(typeof diag.playbackDriftMs).toBe('number');
    expect(typeof diag.rttMedianMs).toBe('number');
    expect(typeof diag.jitterMs).toBe('number');
    expect(typeof diag.packetLossPercent).toBe('number');
    expect(typeof diag.estimatedLeadTimeMs).toBe('number');
    expect(diag.timelineId).toBeDefined();
    expect(typeof diag.revision).toBe('number');

    // 2. Device Information verification
    expect(diag.deviceId).toBeDefined();
    expect(typeof diag.deviceName).toBe('string');
    expect(diag.deviceType).toMatch(/desktop|mobile|tablet/);
    expect(diag.platform).toBeDefined();
    expect(diag.transportLabel).toBeDefined();

    // 3. Playback Diagnostics verification
    expect(diag.trackId).toBe('TRK_123');
    expect(diag.playbackState).toBe('PLAYING');
    expect(diag.generation).toBeGreaterThanOrEqual(1);
    expect(diag.transitionId).toBeDefined();
    expect(diag.timelineId).toBeDefined();
    expect(diag.revision).toBeGreaterThanOrEqual(1);
  });
});
