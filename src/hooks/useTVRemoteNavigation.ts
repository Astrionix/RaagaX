'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function useTVRemoteNavigation() {
  const [isTVMode, setIsTVMode] = useState<boolean>(false);
  const { currentSong, isPlaying, togglePlayPause } = usePlayerStore();
  const focusedIndexRef = useRef<number>(-1);

  // Auto-detect TV environment (Android TV, Mi Box, Leanback, high DPI / TV User Agent)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroidTV = ua.includes('googletv') || ua.includes('androidtv') || ua.includes('smarttv') || ua.includes('mibox') || ua.includes('aftb') || ua.includes('tv');
    if (isAndroidTV) {
      setIsTVMode(true);
      document.body.classList.add('tv-mode-active');
    }
  }, []);

  const toggleTVMode = useCallback(() => {
    setIsTVMode((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next) document.body.classList.add('tv-mode-active');
        else document.body.classList.remove('tv-mode-active');
      }
      return next;
    });
  }, []);

  // Spatial Navigation Algorithm: Finds the nearest element in direction of D-Pad arrow
  const navigateSpatial = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (typeof document === 'undefined') return;

    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-tv-focusable="true"], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex="0"]'
      )
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });

    if (focusables.length === 0) return;

    const activeEl = document.activeElement as HTMLElement | null;

    if (!activeEl || !focusables.includes(activeEl)) {
      focusables[0].focus();
      focusables[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      return;
    }

    const currentRect = activeEl.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestCandidate: HTMLElement | null = null;
    let minDistance = Infinity;

    focusables.forEach((candidate) => {
      if (candidate === activeEl) return;
      const rect = candidate.getBoundingClientRect();
      const candidateCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const dx = candidateCenter.x - currentCenter.x;
      const dy = candidateCenter.y - currentCenter.y;

      let isValidDirection = false;
      let distance = Infinity;

      if (direction === 'UP' && dy < -5) {
        isValidDirection = true;
        distance = Math.abs(dy) + Math.abs(dx) * 1.8; // Penalize horizontal offset for vertical movement
      } else if (direction === 'DOWN' && dy > 5) {
        isValidDirection = true;
        distance = Math.abs(dy) + Math.abs(dx) * 1.8;
      } else if (direction === 'LEFT' && dx < -5) {
        isValidDirection = true;
        distance = Math.abs(dx) + Math.abs(dy) * 1.8;
      } else if (direction === 'RIGHT' && dx > 5) {
        isValidDirection = true;
        distance = Math.abs(dx) + Math.abs(dy) * 1.8;
      }

      if (isValidDirection && distance < minDistance) {
        minDistance = distance;
        bestCandidate = candidate;
      }
    });

    if (bestCandidate) {
      (bestCandidate as HTMLElement).focus();
      (bestCandidate as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, []);

  // Listen for Mi Box & Android TV Remote key events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Auto-enable TV mode when D-Pad key or TV remote key is pressed
      const tvKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Enter', 'Select', 'Escape', 'Backspace', 'GoBack',
        'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaNextTrack', 'MediaPreviousTrack'
      ];
      
      const keyCode = e.keyCode || e.which;
      const isTVKey = tvKeys.includes(e.key) || keyCode === 10009 || keyCode === 13 || keyCode === 27;

      if (isTVKey && !isTVMode) {
        setIsTVMode(true);
        document.body.classList.add('tv-mode-active');
      }

      // Universal Key Code Detection across all Android TV & Smart TV Remotes
      if (e.key === 'ArrowUp' || keyCode === 19) {
        e.preventDefault();
        navigateSpatial('UP');
      } else if (e.key === 'ArrowDown' || keyCode === 20) {
        e.preventDefault();
        navigateSpatial('DOWN');
      } else if (e.key === 'ArrowLeft' || keyCode === 21) {
        e.preventDefault();
        navigateSpatial('LEFT');
      } else if (e.key === 'ArrowRight' || keyCode === 22) {
        e.preventDefault();
        navigateSpatial('RIGHT');
      } else if (e.key === 'Enter' || e.key === 'Select' || keyCode === 23 || keyCode === 66 || keyCode === 13) {
        // OK / SELECT Button: Dispatch click event to currently focused element
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && activeEl !== document.body && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
          e.preventDefault();
          activeEl.click();
        }
      } else if (e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause' || keyCode === 85 || keyCode === 126 || keyCode === 127) {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'MediaNextTrack' || keyCode === 87) {
        e.preventDefault();
        usePlayerStore.getState().playNext();
      } else if (e.key === 'MediaPreviousTrack' || keyCode === 88) {
        e.preventDefault();
        usePlayerStore.getState().playPrev();
      } else if (keyCode === 89) {
        // Rewind 10 seconds
        e.preventDefault();
        const store = usePlayerStore.getState();
        store.seek(Math.max(0, store.currentTime - 10));
      } else if (keyCode === 90) {
        // Fast Forward 10 seconds
        e.preventDefault();
        const store = usePlayerStore.getState();
        store.seek(Math.min(store.duration, store.currentTime + 10));
      } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || keyCode === 4 || keyCode === 10009) {
        // Remote BACK Button: Hierarchical Back Navigation
        const store = usePlayerStore.getState();
        if (store.isPlayerExpanded) {
          e.preventDefault();
          usePlayerStore.setState({ isPlayerExpanded: false });
        } else if (store.isQueueOpen) {
          e.preventDefault();
          store.toggleQueue();
        } else if (store.activeTab !== 'home') {
          e.preventDefault();
          store.setSelectedAlbumId(null);
          store.setSelectedArtistId(null);
          store.setSelectedPlaylistId(null);
          store.setActiveTab('home');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTVMode, navigateSpatial, togglePlayPause]);

  return {
    isTVMode,
    toggleTVMode,
    navigateSpatial,
  };
}
