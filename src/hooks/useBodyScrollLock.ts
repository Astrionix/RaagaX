'use client';

import { useEffect } from 'react';

// Global counter to support multiple nested/stacked modals safely
let activeLockCount = 0;
let preservedScrollY = 0;
let previousBodyStyle: {
  overflow: string;
  position: string;
  top: string;
  width: string;
  htmlOverflow: string;
} | null = null;

/**
 * Universal Mobile & Desktop Body Scroll Lock Hook
 * 
 * Freezes the underlying window/document scroll (such as Home screen)
 * when a modal, full-screen player, or sheet is opened.
 * Prevents scroll chaining, rubber-banding, and background bleed-through.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    if (activeLockCount === 0) {
      preservedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      previousBodyStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        htmlOverflow: document.documentElement.style.overflow,
      };

      // Freeze html and body
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${preservedScrollY}px`;
      document.body.style.width = '100%';
      document.body.classList.add('body-scroll-locked');
    }

    activeLockCount++;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);

      if (activeLockCount === 0 && previousBodyStyle) {
        document.documentElement.style.overflow = previousBodyStyle.htmlOverflow;
        document.body.style.overflow = previousBodyStyle.overflow;
        document.body.style.position = previousBodyStyle.position;
        document.body.style.top = previousBodyStyle.top;
        document.body.style.width = previousBodyStyle.width;
        document.body.classList.remove('body-scroll-locked');

        // Restore exact scroll position
        window.scrollTo(0, preservedScrollY);
        previousBodyStyle = null;
      }
    };
  }, [isLocked]);
}
