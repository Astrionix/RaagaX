'use client';

import React, { useEffect } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useNotificationStore } from '@/context/useNotificationStore';
import { useUpdateStore } from '@/context/useUpdateStore';
import { useDownloadStore } from '@/context/useDownloadStore';

// Global reference counter to support multiple nested/stacked modals safely
let activeLockCount = 0;
let preservedScrollY = 0;
let previousBodyStyle: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  height: string;
  htmlOverflow: string;
  htmlOverscroll: string;
  bodyOverscroll: string;
} | null = null;

// Global touchmove interceptor to completely block background scroll chaining on mobile
function handleTouchMoveWhenLocked(e: TouchEvent) {
  if (activeLockCount <= 0) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Check if touch originated inside a scrollable element (vertical or horizontal)
  const scrollableParent = target.closest(
    '.overflow-y-auto, .overflow-y-scroll, .overflow-auto, .overflow-x-auto, .overflow-x-scroll, [data-scrollable="true"], .main-content, textarea, input'
  ) as HTMLElement | null;

  if (scrollableParent) {
    const canScrollY = scrollableParent.scrollHeight > scrollableParent.clientHeight;
    const canScrollX = scrollableParent.scrollWidth > scrollableParent.clientWidth;
    if (canScrollY || canScrollX) {
      return;
    }
  }

  // Also check if inside any active modal container with scrollable content
  const modalContainer = target.closest('.lens-crystal, [role="dialog"], [data-modal-content]') as HTMLElement | null;
  if (modalContainer && (modalContainer.scrollHeight > modalContainer.clientHeight || modalContainer.scrollWidth > modalContainer.clientWidth)) {
    return;
  }

  // Target is on a backdrop, header, or non-scrollable dead-zone: prevent background leak
  if (e.cancelable) {
    e.preventDefault();
  }
}

export function lockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    preservedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      height: document.body.style.height,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscroll: document.documentElement.style.overscrollBehavior,
      bodyOverscroll: document.body.style.overscrollBehavior,
    };

    // Freeze html and body at current exact scroll position
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.classList.add('has-modal-open');

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${preservedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overscrollBehavior = 'none';
    document.body.classList.add('body-scroll-locked');

    // Attach passive: false touch listener to ensure zero background scroll leakage on mobile
    window.addEventListener('touchmove', handleTouchMoveWhenLocked, { passive: false });
  }

  activeLockCount++;
}

export function unlockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  activeLockCount = Math.max(0, activeLockCount - 1);

  if (activeLockCount === 0 && previousBodyStyle) {
    window.removeEventListener('touchmove', handleTouchMoveWhenLocked);

    document.documentElement.style.overflow = previousBodyStyle.htmlOverflow;
    document.documentElement.style.overscrollBehavior = previousBodyStyle.htmlOverscroll;
    document.documentElement.classList.remove('has-modal-open');

    document.body.style.overflow = previousBodyStyle.overflow;
    document.body.style.position = previousBodyStyle.position;
    document.body.style.top = previousBodyStyle.top;
    document.body.style.left = previousBodyStyle.left;
    document.body.style.right = previousBodyStyle.right;
    document.body.style.width = previousBodyStyle.width;
    document.body.style.height = previousBodyStyle.height;
    document.body.style.overscrollBehavior = previousBodyStyle.bodyOverscroll;
    document.body.classList.remove('body-scroll-locked');

    // Restore exact scroll position without layout shifts or jumps
    window.scrollTo(0, preservedScrollY);
    previousBodyStyle = null;
  }
}

/**
 * Universal Mobile & Desktop Body Scroll Lock Hook
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

/**
 * Global Modal Scroll Lock Manager
 * Mounts at root (page.tsx) to automatically track all store modals and any portal overlays in the DOM.
 */
export function GlobalModalScrollLockManager() {
  const isPlayerModalOpen = usePlayerStore((s) => Boolean(
    s.isPlayerExpanded ||
    s.isQueueOpen ||
    s.isLyricsOpen ||
    s.isSleepTimerModalOpen ||
    s.isCastModalOpen ||
    s.isJamModalOpen ||
    s.isBlendModalOpen ||
    s.isSettingsModalOpen ||
    Boolean(s.contextMenuSong) ||
    s.createPlaylistModalOpen ||
    s.isWrappedModalOpen ||
    s.isEqualizerOpen ||
    s.isCarModeOpen ||
    s.isGetAppModalOpen ||
    s.isImporterOpen ||
    s.isBackupOpen ||
    s.isOnboardingOpen ||
    s.isLockScreenOpen ||
    s.isNotificationShadeOpen ||
    s.isSystemSurfacesOpen
  ));

  const isAuthModalOpen = useAuthStore((s) => Boolean(s.isAuthModalOpen));
  const isNotificationOpen = useNotificationStore((s) => Boolean(s.isOpen));
  const isUpdateModalOpen = useUpdateStore((s) => Boolean(s.showModal));
  const isSetupModalOpen = useDownloadStore((s) => Boolean(s.isSetupModalOpen));

  const isAnyStoreModalOpen = Boolean(
    isPlayerModalOpen ||
    isAuthModalOpen ||
    isNotificationOpen ||
    isUpdateModalOpen ||
    isSetupModalOpen
  );

  useBodyScrollLock(isAnyStoreModalOpen);

  // Fallback DOM Portal Observer: detects any dynamically mounted visible portal modals
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let wasPortalDetected = false;

    const checkPortals = () => {
      // Find visible portal modals (must have role="dialog" or explicit modal data attribute)
      const modalElements = document.querySelectorAll(
        '[role="dialog"], [data-modal-portal="true"], .z-\\[9999\\], .z-\\[10000\\], .z-\\[10001\\], .z-\\[10002\\]'
      );
      
      const activeVisiblePortals = Array.from(modalElements).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      const isPortalOpen = activeVisiblePortals.length > 0;

      if (isPortalOpen && !wasPortalDetected) {
        wasPortalDetected = true;
        lockBodyScroll();
      } else if (!isPortalOpen && wasPortalDetected) {
        wasPortalDetected = false;
        unlockBodyScroll();
      }
    };

    const observer = new MutationObserver(() => {
      checkPortals();
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      observer.disconnect();
      if (wasPortalDetected) {
        unlockBodyScroll();
      }
    };
  }, []);

  return null;
}
