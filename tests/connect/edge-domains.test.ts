/**
 * RaagaX Connect — Critical Edge Domains Test Suite
 * Tests NTP drift correction, Gapless sample trimming, ABR adaptation,
 * Jam collaborative permissions, and MediaSession lock screen binding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NtpClockEngine } from '../../src/lib/connect/protocol/NtpClockEngine';
import { GaplessMediaEngine } from '../../src/lib/connect/protocol/GaplessMediaEngine';
import { JamPermissionGuard } from '../../src/lib/connect/protocol/JamPermissionGuard';
import { MediaSessionBridge } from '../../src/lib/connect/protocol/MediaSessionBridge';
import { TrackMetadata } from '../../src/lib/connect/protocol/types';

describe('Connect Edge Domains — Production Robustness Suite', () => {
  // ── 1. NTP Clock Drift Compensation ──────────────────────────────
  describe('1. NTP Clock Drift Compensation', () => {
    let ntp: NtpClockEngine;

    beforeEach(() => {
      ntp = NtpClockEngine.getInstance();
      ntp.reset();
    });

    it('Accurately aligns client time with server timeline across network RTT', () => {
      // Client send: 1000ms, Server time: 1050ms, Client receive: 1020ms
      // RTT = 20ms. Server time at mid-flight = 1050ms.
      // Expected clock offset = 1050 - (1000 + 10) = +40ms.
      const sample = ntp.recordSample(1000, 1050, 1020);

      expect(sample.rtt).toBe(20);
      expect(sample.offset).toBe(40);

      const stats = ntp.getStats();
      expect(stats.isSynchronized).toBe(true);
      expect(stats.clockOffsetMs).toBe(40);

      // Verify server-aligned calculation
      const clientNow = 2000;
      expect(ntp.getServerAlignedTime(clientNow)).toBe(2040);
    });

    it('Discards high-latency jitter spikes using RTT percentile filter', () => {
      // 3 normal samples with 20ms RTT and ~50ms offset
      ntp.recordSample(1000, 1060, 1020);
      ntp.recordSample(2000, 2060, 2020);
      ntp.recordSample(3000, 3060, 3020);

      // Spike with 500ms RTT and skewed offset
      ntp.recordSample(4000, 4200, 4500);

      const stats = ntp.getStats();
      // Jitter spike should be filtered out by outlier rejection
      expect(stats.rttMs).toBeLessThan(100);
      expect(stats.clockOffsetMs).toBeCloseTo(50, -1);
    });
  });

  // ── 2. Gapless Sample Trimming & ABR ──────────────────────────────
  describe('2. Gapless Sample Trimming & Adaptive Bitrate', () => {
    let gapless: GaplessMediaEngine;

    beforeEach(() => {
      gapless = GaplessMediaEngine.getInstance();
    });

    it('Parses Apple iTunSMPB container headers for gapless sample offsets', () => {
      // Standard iTunSMPB string with delay=0x200 (512) and padding=0x800 (2048)
      const rawHeader = ' 00000000 00000200 00000800 0000000000010000 00000000';
      const meta = gapless.parseEncoderDelay(rawHeader, 44100);

      expect(meta.encoderDelaySamples).toBe(512);
      expect(meta.encoderPaddingSamples).toBe(2048);
    });

    it('Steps down bitrate tier (320 -> 160 -> 96) on buffer underrun', () => {
      expect(gapless.getCurrentBitrate()).toBe(320);

      // First buffer underrun
      const tier1 = gapless.recordBufferStarvation();
      // Second underrun within 30s triggers step down
      const tier2 = gapless.recordBufferStarvation();
      expect(tier2).toBe(160);

      // Third underrun within 30s triggers step down to minimum
      const tier3 = gapless.recordBufferStarvation();
      expect(tier3).toBe(96);
    });
  });

  // ── 3. Jam Multi-User Role Permissions ────────────────────────────
  describe('3. Jam Multi-User Capability & Policy Enforcement', () => {
    let jam: JamPermissionGuard;

    beforeEach(() => {
      jam = JamPermissionGuard.getInstance();
      jam.registerParticipant({
        userId: 'usr_host',
        deviceId: 'dev_host',
        name: 'Host User',
        role: 'HOST',
        joinedAtMs: Date.now(),
      });
      jam.registerParticipant({
        userId: 'usr_guest',
        deviceId: 'dev_guest',
        name: 'Guest User',
        role: 'GUEST',
        joinedAtMs: Date.now(),
      });
      jam.setPolicy({
        allowGuestControl: false,
        allowGuestSkip: false,
        voteSkipThreshold: 0.5,
      });
    });

    it('Allows Host full playback override while preventing Guests from altering playback', () => {
      // Host can do everything
      expect(jam.canExecuteAction('usr_host', 'TRANSFER_PLAYBACK').authorized).toBe(true);
      expect(jam.canExecuteAction('usr_host', 'PAUSE').authorized).toBe(true);

      // Guest cannot pause or transfer playback by default
      expect(jam.canExecuteAction('usr_guest', 'PAUSE').authorized).toBe(false);
      expect(jam.canExecuteAction('usr_guest', 'TRANSFER_PLAYBACK').authorized).toBe(false);

      // Guest can always add to queue
      expect(jam.canExecuteAction('usr_guest', 'QUEUE_MUTATE').authorized).toBe(true);
    });

    it('Handles democratic vote-to-skip threshold when direct skip is disabled', () => {
      // Direct skip rejected
      const directSkip = jam.canExecuteAction('usr_guest', 'SKIP_NEXT');
      expect(directSkip.authorized).toBe(false);

      // Cast vote-to-skip
      const vote = jam.castSkipVote('usr_guest');
      expect(vote.voteRegistered).toBe(true);
      expect(vote.thresholdReached).toBe(true); // 1 guest out of 1 -> 100% threshold reached
    });
  });

  // ── 4. MediaSession Lock Screen Binding ───────────────────────────
  describe('4. Native Lock Screen MediaSession Binding', () => {
    let mediaBridge: MediaSessionBridge;

    const mockTrack: TrackMetadata = {
      uri: 'https://cdn.raagax.com/audio/fidaa.mp3',
      title: 'Oosupodu',
      artist: 'Vedala Hemachandra',
      album: 'Fidaa',
      artworkUrl: 'https://cdn.raagax.com/art/fidaa.png',
      durationMs: 252000,
      bitrateBps: 320000,
    };

    beforeEach(() => {
      mediaBridge = MediaSessionBridge.getInstance();
    });

    it('Registers action callbacks cleanly without throwing', () => {
      let playTriggered = false;
      let pauseTriggered = false;

      mediaBridge.register({
        onPlay: () => { playTriggered = true; },
        onPause: () => { pauseTriggered = true; },
        onNext: () => {},
        onPrev: () => {},
        onSeekTo: () => {},
      });

      mediaBridge.updateMetadata(mockTrack, 'Living Room Speaker');
      mediaBridge.updatePositionState(45000, 252000, 'PLAYING');

      // Assert clean unregister and teardown
      mediaBridge.destroy();
      expect(playTriggered).toBe(false);
      expect(pauseTriggered).toBe(false);
    });
  });
});
