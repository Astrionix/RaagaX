/**
 * useGlobalKeyboardShortcuts
 *
 * Single, application-level keyboard shortcut handler for RaagaX Desktop/Web.
 * Registered exactly once on mount, regardless of which view or modal is open.
 *
 * Architecture:
 *   Physical key press
 *     → this hook (window, capture=false, registered once)
 *     → usePlayerStore.getState().togglePlayPause()   ← live state, no stale closure
 *     → PlaybackService / RaagaXNativePlayer
 *     → Audio engine
 *
 * Design decisions:
 * - Uses `usePlayerStore.getState()` directly to avoid stale-closure issues
 *   (all store action references are stable; getState() always returns current state).
 * - Guards against editable targets (input, textarea, select, contenteditable).
 * - Guards against button/link targets for Space (lets native activation work).
 * - Guards against event.repeat to prevent hold-key multi-toggle.
 * - Uses event.code === 'Space' (physical key, locale-independent).
 * - Registered with an AbortController so cleanup is deterministic even under
 *   React Strict Mode double-invoke or Fast Refresh.
 * - Development-only console logging via [KeyboardShortcut] prefix.
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the keyboard event's target should absorb Space naturally. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Returns true when Space should activate a focused interactive element
 * rather than toggle playback. Preserves native browser keyboard accessibility.
 */
function isFocusedInteractive(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  // Buttons and links: let Space activate them natively (browser default).
  // Sliders (range inputs) need Space too — but those are INPUT so caught above.
  return tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
}

const isDev = process.env.NODE_ENV === 'development';

function devLog(action: string, extra?: Record<string, unknown>) {
  if (!isDev) return;
  console.log(`[KeyboardShortcut]`, { action, ...extra });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGlobalKeyboardShortcuts() {
  // Use a ref to hold the abort controller so it survives re-renders without
  // triggering the effect again (effect has an empty dep array).
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clean up any previous registration (handles React Strict Mode double-invoke
    // and Fast Refresh).
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Guard: key repeat (user holding the key) ──────────────────────────
      if (e.repeat) return;

      // ── Guard: editable targets ───────────────────────────────────────────
      if (isEditableTarget(e.target)) return;

      // ── Space → toggle play/pause ─────────────────────────────────────────
      if (e.code === 'Space') {
        // Let focused buttons/links handle Space natively (accessibility).
        if (isFocusedInteractive(e.target)) return;

        // Prevent the browser from scrolling the page.
        e.preventDefault();

        // ─── Use getState() to always read current live state ─────────────
        // This avoids stale-closure issues that arise when the action is
        // captured inside a useEffect dependency array.
        const store = usePlayerStore.getState();

        if (!store.currentSong) {
          devLog('SPACE_NO_SONG', { reason: 'No active track' });
          return;
        }

        devLog('SPACE_TOGGLE', {
          target: (e.target as HTMLElement)?.tagName ?? 'UNKNOWN',
          wasPlaying: store.isPlaying,
        });

        store.togglePlayPause();

        devLog(store.isPlaying ? 'PAUSE_DISPATCHED' : 'PLAY_DISPATCHED');
        return;
      }

      // ── ArrowLeft / ArrowRight → seek 5s ─────────────────────────────────
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (isFocusedInteractive(e.target)) return;
        e.preventDefault();
        const store = usePlayerStore.getState();
        const cur = store.currentTime ?? 0;
        const dur = store.duration ?? 0;
        const delta = e.code === 'ArrowLeft' ? -5 : 5;
        const newTime = Math.max(0, Math.min(dur, cur + delta));
        store.setCurrentTime(newTime, true);
        usePlayerStore.setState({ seekTarget: newTime });
        devLog('SEEK', { direction: e.code, from: cur, to: newTime });
        return;
      }

      // ── ArrowUp / ArrowDown → volume ──────────────────────────────────────
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        if (isFocusedInteractive(e.target)) return;
        e.preventDefault();
        const delta = e.code === 'ArrowUp' ? 0.05 : -0.05;

        const store = usePlayerStore.getState();
        const newVol = parseFloat(
          Math.max(0, Math.min(1, (store.volume ?? 1) + delta)).toFixed(2)
        );
        store.setVolume(newVol);
        return;
      }

      // ── Letter shortcuts (only when no modifier held) ─────────────────────
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.code) {
        case 'KeyN': usePlayerStore.getState().playNext(); break;
        case 'KeyP': usePlayerStore.getState().playPrev(); break;
        case 'KeyM': usePlayerStore.getState().toggleMute(); break;
        case 'KeyS': usePlayerStore.getState().toggleShuffle(); break;
        case 'KeyR': usePlayerStore.getState().cycleRepeatMode(); break;
        case 'KeyL': usePlayerStore.getState().toggleLyrics?.(); break;
        case 'KeyQ': usePlayerStore.getState().toggleQueue?.(); break;
        case 'Slash': {
          e.preventDefault();
          const searchInput = document.getElementById('sidebar-search-input') as HTMLInputElement | null;
          if (searchInput) {
            usePlayerStore.getState().setActiveTab('search');
            searchInput.focus();
            searchInput.select();
          }
          break;
        }
        default:
          break;
      }
    };

    // Register with AbortController signal — no manual removeEventListener needed.
    window.addEventListener('keydown', handleKeyDown, {
      signal: controller.signal,
      capture: false,
    });

    // ── Android Hardware Volume Rockers ──────────────────────────────────────
    const handleHardwareVolume = (event: any) => {
      const direction = event.detail?.direction;
      const delta = direction === 'UP' ? 0.05 : -0.05;
      const store = usePlayerStore.getState();
      const newVol = parseFloat(
        Math.max(0, Math.min(1, (store.volume ?? 1) + delta)).toFixed(2)
      );
      store.setVolume(newVol);
    };

    window.addEventListener('hardwareVolumeChange', handleHardwareVolume, {
      signal: controller.signal,
      capture: false,
    });

    devLog('LISTENER_REGISTERED');

    return () => {
      controller.abort();
      devLog('LISTENER_REMOVED');
    };
    // Empty dep array: registered exactly once for the component lifetime.
    // All store reads use getState() to avoid stale closures.
  }, []);
}
