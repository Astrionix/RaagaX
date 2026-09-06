/**
 * RaagaX AudioUnlocker
 * 
 * Unlocks browser audio playback capability (Autoplay Policy / Media Engagement Index)
 * on the very first user interaction anywhere in the document (pointerdown, keydown, touchstart, click).
 * 
 * Directly primes both HTMLAudioElements (audioA, audioB) so remote Spotify Connect
 * commands can trigger audio.play() seamlessly without NotAllowedError.
 */

const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let isAudioUnlocked = false;
let isListenersAttached = false;
let isUnlocking = false;
const registeredElements = new Set<HTMLAudioElement>();

// Probe browser autoplay policy immediately if supported
if (typeof navigator !== 'undefined' && 'getAutoplayPolicy' in navigator) {
  try {
    const policy = (navigator as any).getAutoplayPolicy('mediaelement');
    if (policy === 'allowed') {
      isAudioUnlocked = true;
    }
  } catch {}
}

export function registerAudioForUnlock(element: HTMLAudioElement): void {
  if (!element) return;
  registeredElements.add(element);
}

export function isAudioGloballyUnlocked(): boolean {
  return isAudioUnlocked;
}

export async function activatePlayer(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isAudioUnlocked) return true;
  if (typeof unlockAudioRef === 'function') {
    await unlockAudioRef();
  }
  return isAudioUnlocked;
}

let unlockAudioRef: (() => Promise<void>) | null = null;

export function initAudioUnlocker(elements?: HTMLAudioElement | HTMLAudioElement[]): void {
  if (typeof window === 'undefined') return;

  if (elements) {
    const list = Array.isArray(elements) ? elements : [elements];
    list.forEach((el) => {
      if (el) registeredElements.add(el);
    });
  }

  if (isAudioUnlocked || isListenersAttached) return;
  isListenersAttached = true;

  const unlockAudio = async () => {
    if (isAudioUnlocked || isUnlocking) return;
    isUnlocking = true;
    try {
      // 1. Prime registered audio elements (audioA, audioB) that are uninitialized
      for (const el of Array.from(registeredElements)) {
        if (!el) continue;
        el.preload = 'auto';
        const prevSrc = el.src;
        try {
          // If the element already has a real media source waiting to play, resume it immediately in user gesture!
          if (prevSrc && !prevSrc.startsWith('data:') && prevSrc !== 'about:blank') {
            const { usePlayerStore } = await import('@/context/usePlayerStore');
            const store = usePlayerStore.getState();
            store.setIsAutoplayBlocked(false);
            if (store.isLocalPlayback && store.playbackIntent === 'PLAYING') {
              await el.play();
              store.setIsPlaying(true);
            }
          } else {
            // Only prime empty or silent dummy elements.
            el.src = SILENT_WAV;
            await el.play();
            el.pause();
            el.currentTime = 0;
            if (prevSrc && !prevSrc.startsWith('data:')) {
              el.src = prevSrc;
            }
          }
        } catch {
        } finally {
          // CRITICAL: Always ensure element is unmuted so user hears audio output!
          try {
            const { usePlayerStore } = await import('@/context/usePlayerStore');
            el.muted = Boolean(usePlayerStore.getState().isMuted);
          } catch {
            el.muted = false;
          }
        }
      }

      // 2. Prime fallback dummy audio
      const dummy = new Audio(SILENT_WAV);
      await dummy.play().catch(() => {});
      dummy.pause();

      isAudioUnlocked = true;
      console.log('[AudioUnlocker] AudioContext & HTMLAudioElement unlocked successfully');

      // Update store and notify device presence across local & cloud
      try {
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        usePlayerStore.getState().setIsAudioReady(true);
        usePlayerStore.getState().setIsAutoplayBlocked(false);
      } catch {}

      try {
        const { DeviceDiscoveryEngine } = await import('@/lib/connect/discovery/DeviceDiscoveryEngine');
        DeviceDiscoveryEngine.getInstance().requestDiscoveryRefresh();
      } catch {}

      // 3. Notify PlaybackService to unblock any pending watchdog / remote play
      try {
        const { PlaybackService } = await import('./PlaybackService');
        PlaybackService.getInstance().onAudioUnlocked();
      } catch {}
    } catch (e) {
      // User hasn't finished interaction yet
    } finally {
      isUnlocking = false;
      unlockAudioRef = null;
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
      window.removeEventListener('touchstart', unlockAudio, true);
      window.removeEventListener('click', unlockAudio, true);
    }
  };

  unlockAudioRef = unlockAudio;

  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true, capture: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true, capture: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true, capture: true });
  window.addEventListener('click', unlockAudio, { once: true, passive: true, capture: true });
}
