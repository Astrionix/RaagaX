import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebAudioHardwareSync } from '@/lib/jam/WebAudioHardwareSync';
import { JamMeshTransport } from '@/lib/jam/JamMeshTransport';
import { JamSessionManager } from '@/lib/jam/JamSessionManager';

describe('WebAudioHardwareSync (Hardware-Level DAC Phase Lock)', () => {
  beforeEach(() => {
    WebAudioHardwareSync.getInstance().stop();
  });

  it('calculates local performance offset accurately from NTP ping-pong sample', () => {
    const sync = WebAudioHardwareSync.getInstance();
    const perfSpy = vi.spyOn(performance, 'now');
    
    // Client sent at perf 1000, Host received at perf 1005, Client received pong at perf 1010
    // RTT = 1010 - 1000 = 10ms
    // One-way transit = 5ms
    // Host time at receive = 1005 + 5 = 1010
    // Client perf time at receive = 1010
    // Offset = 1010 - 1010 = 0ms
    perfSpy.mockReturnValue(1010);
    sync.calculateLocalOffset(1005, 1000);
    expect(sync.getLocalPerfOffsetMs()).toBeCloseTo(0, 1);

    // Test with a 50ms clock offset between host and guest
    // Client sent at 2000, Host at 2055, Client received at 2010
    // RTT = 10ms, one-way = 5ms
    // Accurate host time = 2055 + 5 = 2060
    // Client receive = 2010 -> offset = +50ms
    perfSpy.mockReturnValue(2010);
    sync.calculateLocalOffset(2055, 2000);
    // Weighted moving average: 0 * 0.7 + 50 * 0.3 = 15ms
    expect(sync.getLocalPerfOffsetMs()).toBeCloseTo(15, 1);

    perfSpy.mockRestore();
  });

  it('provides safe fallback when audio buffer is not yet decoded', () => {
    const sync = WebAudioHardwareSync.getInstance();
    const played = sync.playAtExactHardwareTime(performance.now() + 350, 0);
    // Returns false safely without throwing errors
    expect(played).toBe(false);
    expect(sync.isPlaying()).toBe(false);
  });

  it('properly resets and stops active hardware playback on demand', () => {
    const sync = WebAudioHardwareSync.getInstance();
    sync.stop();
    expect(sync.isPlaying()).toBe(false);
    expect(sync.getHardwareCurrentTime()).toBe(0);
  });
});

describe('JamMeshTransport (Local Wi-Fi WebRTC P2P DataChannel Mesh)', () => {
  beforeEach(() => {
    JamMeshTransport.getInstance().destroy();
  });

  it('initializes host and guest transports with clean peer maps', () => {
    const mesh = JamMeshTransport.getInstance();
    const mockChannel: any = { send: vi.fn() };
    const mockCallback = vi.fn();

    mesh.init('jam_999888', true, 'device_host_1', mockChannel, mockCallback);
    expect(mesh.hasActiveDirectChannel()).toBe(false);

    mesh.init('jam_999888', false, 'device_guest_1', mockChannel, mockCallback);
    expect(mesh.hasActiveDirectChannel()).toBe(false);
  });

  it('broadcasts safely and reports whether direct DataChannel was used', () => {
    const mesh = JamMeshTransport.getInstance();
    mesh.init('jam_999888', true, 'device_host_1', null, () => {});

    // When no peer DataChannels are open, broadcast returns false (falls back to Supabase)
    const sentDirect = mesh.broadcast({ type: 'TEST_PING' });
    expect(sentDirect).toBe(false);
  });

  it('ignores signaling messages directed to other devices', async () => {
    const mesh = JamMeshTransport.getInstance();
    mesh.init('jam_999888', false, 'device_guest_me', null, () => {});

    // Signal intended for someone else
    await mesh.handleSignaling({
      targetDeviceId: 'device_other_person',
      senderDeviceId: 'device_host_1',
      signal: { sdp: { type: 'offer', sdp: 'dummy' } },
    });

    expect(mesh.hasActiveDirectChannel()).toBe(false);
  });

  it('cleanly destroys all peers and resources upon room exit', () => {
    const mesh = JamMeshTransport.getInstance();
    mesh.init('jam_999888', true, 'device_host_1', null, () => {});
    mesh.destroy();
    expect(mesh.hasActiveDirectChannel()).toBe(false);
  });
});

describe('Multi-Speaker Party Mode Coordination in JamSessionManager', () => {
  beforeEach(() => {
    JamSessionManager.getInstance().leaveJam();
  });

  it('Host switches to MULTI_SPEAKER mode and enables local audio output', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.startJam();

    jam.setAudioMode('MULTI_SPEAKER');
    const state = jam.getState();
    expect(state.audioMode).toBe('MULTI_SPEAKER');
    expect(state.isLocalAudioOutput).toBe(true);
  });

  it('switching away from MULTI_SPEAKER stops hardware WebAudio synchronization', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.startJam();

    const stopSpy = vi.spyOn(WebAudioHardwareSync.getInstance(), 'stop');
    jam.setAudioMode('MULTI_SPEAKER');
    jam.setAudioMode('IN_PERSON');

    expect(stopSpy).toHaveBeenCalled();
  });
});
