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
const registeredElements = new Set<HTMLAudioElement>();

export function registerAudioForUnlock(element: HTMLAudioElement): void {
  if (!element) return;
  registeredElements.add(element);
}

export function isAudioGloballyUnlocked(): boolean {
  return isAudioUnlocked;
}

export function initAudioUnlocker(elements?: HTMLAudioElement | HTMLAudioElement[]): void {
  if (typeof window === 'undefined') return;

  if (elements) {
    const list = Array.isArray(elements) ? elements : [elements];
    list.forEach((el) => {
      if (el) registeredElements.add(el);
    });
  }

  if (isAudioUnlocked) return;

  const unlockAudio = async () => {
    try {
      // 1. Prime each registered audio element (audioA, audioB)
      for (const el of Array.from(registeredElements)) {
        if (!el) continue;
        el.preload = 'auto';
        if (!el.src || el.src.startsWith('data:')) {
          const prevSrc = el.src;
          el.src = SILENT_WAV;
          try {
            await el.play();
            el.pause();
            el.currentTime = 0;
          } catch {}
          if (prevSrc && !prevSrc.startsWith('data:')) {
            el.src = prevSrc;
          }
        }
      }

      // 2. Prime fallback dummy audio
      const dummy = new Audio(SILENT_WAV);
      await dummy.play().catch(() => {});
      dummy.pause();

      isAudioUnlocked = true;
      console.log('[AudioUnlocker] AudioContext & HTMLAudioElement unlocked successfully');

      // 3. Notify PlaybackService to unblock any pending watchdog / remote play
      try {
        const { PlaybackService } = await import('./PlaybackService');
        PlaybackService.getInstance().onAudioUnlocked();
      } catch {}
    } catch (e) {
      // User hasn't finished interaction yet
    } finally {
      if (isAudioUnlocked) {
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('click', unlockAudio);
      }
    }
  };

  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
}
