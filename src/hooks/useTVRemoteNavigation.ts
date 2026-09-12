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

      // Handle Key Navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigateSpatial('UP');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateSpatial('DOWN');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateSpatial('LEFT');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateSpatial('RIGHT');
          break;
        case 'MediaPlayPause':
        case 'MediaPlay':
        case 'MediaPause':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'MediaNextTrack':
          e.preventDefault();
          usePlayerStore.getState().playNext();
          break;
        case 'MediaPreviousTrack':
          e.preventDefault();
          usePlayerStore.getState().playPrev();
          break;
        default:
          if (keyCode === 10009 || e.key === 'GoBack') {
            // Android TV Back Button (Mi Box KeyCode 10009)
            const playerState = usePlayerStore.getState();
            if (playerState.isPlayerExpanded) {
              e.preventDefault();
              usePlayerStore.setState({ isPlayerExpanded: false });
            }
          }
          break;
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
