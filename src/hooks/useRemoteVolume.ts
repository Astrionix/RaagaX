/**
 * useRemoteVolume — Remote Volume Control Hook
 *
 * Handles the full volume control flow for both modes:
 *
 * CONTROLLER MODE (isRemoteMode = true):
 *   - Slider moves → optimistic local UI update at 60fps
 *   - Leading+trailing edge throttle (40ms) before network dispatch
 *   - Dispatches SET_VOLUME to the speaker via ConnectClientManager
 *   - NEVER touches local audio elements
 *
 * SPEAKER MODE (isRemoteMode = false):
 *   - Slider moves → SpeakerVolumeGainManager.setSmoothVolume() (25ms ramp)
 *   - Updates Zustand store (persisted to session)
 *   - No network dispatch (direct local audio control)
 *
 * Incoming sync: when the speaker changes volume (keyboard, etc.),
 * the ConnectPlaybackSession carries the new volume → remoteSession.volume
 * → this hook reads it and syncs the UI slider without re-dispatching.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';

/** Leading+trailing throttle interval for network dispatch (ms) */
const DISPATCH_THROTTLE_MS = 40;

export function useRemoteVolume() {
  const isRemoteMode = useConnectStore((s) => s.isRemoteMode);
  const sendVolume = useConnectStore((s) => s.sendVolume);
  const remoteSession = useConnectStore((s) => s.remoteSession);

  const storeVolume = usePlayerStore((s) => s.volume);
  const storeMuted = usePlayerStore((s) => s.isMuted);
  const storeSetVolume = usePlayerStore((s) => s.setVolume);

  /**
   * Optimistic display volume — updated immediately at 60fps for
   * smooth thumb movement, without waiting for network round-trip.
   */
  const [displayVolume, setDisplayVolume] = useState<number>(
    isRemoteMode ? (remoteSession?.volume ?? storeVolume) : storeVolume
  );
  const [isMuted, setIsMuted] = useState(storeMuted);

  /** Pre-mute volume for restore */
  const premuteRef = useRef<number>(storeVolume > 0 ? storeVolume : 0.8);

  /** Throttle timer handle */
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last dispatched value (avoids redundant sends) */
  const lastDispatchedRef = useRef<number>(displayVolume);
  /** Whether a trailing dispatch is pending */
  const pendingRef = useRef<number | null>(null);

  // ── Incoming sync from speaker (remote session volume changed externally) ──
  useEffect(() => {
    if (!isRemoteMode) return;
    const remoteVol = remoteSession?.volume;
    if (typeof remoteVol === 'number' && Math.abs(remoteVol - displayVolume) > 0.005) {
      setDisplayVolume(remoteVol);
    }
  }, [remoteSession?.volume, isRemoteMode]);

  // ── Sync display from store when NOT in remote mode ──
  useEffect(() => {
    if (isRemoteMode) return;
    setDisplayVolume(storeVolume);
    setIsMuted(storeMuted);
  }, [storeVolume, storeMuted, isRemoteMode]);

  /** Dispatch volume to network (throttled) */
  const dispatchVolume = useCallback((vol: number) => {
    if (isRemoteMode) {
      sendVolume(vol);
    } else {
      // Speaker: apply smooth ramp via SpeakerVolumeGainManager
      import('@/lib/playback/SpeakerVolumeGainManager').then(({ SpeakerVolumeGainManager }) => {
        SpeakerVolumeGainManager.getInstance().setSmoothVolume(vol);
      });
      storeSetVolume(vol);
    }
    lastDispatchedRef.current = vol;
    pendingRef.current = null;
  }, [isRemoteMode, sendVolume, storeSetVolume]);

  /**
   * Called on every slider onChange event.
   * Updates display immediately (optimistic), throttles network dispatch.
   */
  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));

    // Immediate optimistic UI update
    setDisplayVolume(clamped);
    if (clamped > 0) setIsMuted(false);

    pendingRef.current = clamped;

    if (throttleRef.current === null) {
      // Leading edge: dispatch immediately
      dispatchVolume(clamped);

      // Start throttle window — dispatch trailing edge if moved again
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        // Trailing edge: flush if there's a pending value that wasn't sent
        if (pendingRef.current !== null && pendingRef.current !== lastDispatchedRef.current) {
          dispatchVolume(pendingRef.current);
        }
      }, DISPATCH_THROTTLE_MS);
    }
    // If within throttle window, pendingRef holds latest — trailing flush will send it
  }, [dispatchVolume]);

  const handleMuteToggle = useCallback(() => {
    if (isRemoteMode) {
      // In remote mode: send SET_VOLUME 0 to mute, restore pre-mute on un-mute
      if (!isMuted) {
        if (displayVolume > 0) premuteRef.current = displayVolume;
        setDisplayVolume(0);
        setIsMuted(true);
        sendVolume(0);
      } else {
        const restored = premuteRef.current > 0 ? premuteRef.current : 0.8;
        setDisplayVolume(restored);
        setIsMuted(false);
        sendVolume(restored);
      }
    } else {
      // Speaker mode: use SpeakerVolumeGainManager for smooth toggle
      import('@/lib/playback/SpeakerVolumeGainManager').then(({ SpeakerVolumeGainManager }) => {
        SpeakerVolumeGainManager.getInstance().toggleMute();
        setIsMuted(usePlayerStore.getState().isMuted);
        setDisplayVolume(usePlayerStore.getState().volume);
      });
    }
  }, [isRemoteMode, isMuted, displayVolume, sendVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, []);

  return {
    /** Volume to display (0–1), updated optimistically */
    displayVolume,
    isMuted,
    isRemoteMode,
    /** Call on slider onChange */
    handleVolumeChange,
    /** Call on mute button click */
    handleMuteToggle,
  };
}
