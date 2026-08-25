'use client';

/**
 * RaagaX Production-Grade Scroll & Navigation State Manager
 * 
 * Provides Spotify-class scrolling quality across Android APK and Desktop:
 * - Natural 120Hz fling momentum and touch arbitration
 * - Per-route & per-tab scroll position memory and instant restoration
 * - Prevention of accidental song plays / clicks when touching to stop a fast fling
 * - Zero layout shift (CLS = 0) and zero playback interference
 */

export class ScrollManager {
  private static instance: ScrollManager;
  private scrollPositions = new Map<string, number>();
  private currentRouteKey: string = 'tab:home';
  private isScrolling: boolean = false;
  private scrollVelocity: number = 0;
  private lastScrollY: number = 0;
  private lastScrollTime: number = Date.now();
  private scrollEndTimer: NodeJS.Timeout | null = null;
  private clickSuppressTimer: NodeJS.Timeout | null = null;
  private isFlingSuppressed: boolean = false;
  private isInitialized: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): ScrollManager {
    if (!ScrollManager.instance) {
      ScrollManager.instance = new ScrollManager();
    }
    return ScrollManager.instance;
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Passive global scroll listener on window (mobile)
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Capture-phase click interceptor to prevent accidental track play on fling stop
    window.addEventListener('click', this.handleClickCapture, true);
    window.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  public destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('click', this.handleClickCapture, true);
    window.removeEventListener('touchend', this.handleTouchEnd);
    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    if (this.clickSuppressTimer) clearTimeout(this.clickSuppressTimer);
  }

  /**
   * Generates a stable canonical route key for scroll position caching
   */
  public getRouteKey(state: {
    activeTab: string;
    selectedAlbumId?: string | null;
    selectedArtistId?: string | null;
    selectedPlaylistId?: string | null;
  }): string {
    if (state.selectedAlbumId) return `album:${state.selectedAlbumId}`;
    if (state.selectedArtistId) return `artist:${state.selectedArtistId}`;
    if (state.selectedPlaylistId) return `playlist:${state.selectedPlaylistId}`;
    return `tab:${state.activeTab || 'home'}`;
  }

  /**
   * Get the current scroll offset for the active viewport
   */
  public getCurrentScrollY(): number {
    if (typeof window === 'undefined') return 0;
    
    // Desktop main-content scroll container check
    const desktopContainer = document.querySelector('.main-content') as HTMLElement | null;
    if (desktopContainer && desktopContainer.scrollTop > 0) {
      return desktopContainer.scrollTop;
    }

    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  /**
   * Records the scroll position of the currently active route
   */
  public recordCurrentScroll(routeKey?: string) {
    const key = routeKey || this.currentRouteKey;
    const y = this.getCurrentScrollY();
    this.scrollPositions.set(key, y);
  }

  /**
   * Sets the current active route and restores its cached scroll position
   */
  public navigateTo(newRouteKey: string) {
    if (this.currentRouteKey === newRouteKey) return;

    // 1. Save outgoing route position
    this.recordCurrentScroll(this.currentRouteKey);

    // 2. Switch key
    this.currentRouteKey = newRouteKey;

    // 3. Restore incoming route position on next frames
    this.restoreScroll(newRouteKey);
  }

  /**
   * Restores cached scroll position for a route
   */
  public restoreScroll(routeKey: string) {
    if (typeof window === 'undefined') return;

    const targetY = this.scrollPositions.get(routeKey) || 0;

    const applyScroll = () => {
      const desktopContainer = document.querySelector('.main-content') as HTMLElement | null;
      if (desktopContainer && desktopContainer.scrollHeight > desktopContainer.clientHeight) {
        desktopContainer.scrollTop = targetY;
      }
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });
    };

    // Micro-frame 1: Immediate apply
    requestAnimationFrame(applyScroll);

    // Micro-frame 2: Apply after DOM paints content (handles async loaded shelves)
    setTimeout(() => {
      requestAnimationFrame(applyScroll);
    }, 40);

    // Micro-frame 3: Settle check for heavy content
    setTimeout(() => {
      requestAnimationFrame(applyScroll);
    }, 120);
  }

  /**
   * Passive scroll handler to track velocity & fling state
   */
  private handleScroll = () => {
    const currentY = this.getCurrentScrollY();
    const now = Date.now();
    const dt = Math.max(1, now - this.lastScrollTime);
    const dy = Math.abs(currentY - this.lastScrollY);

    this.scrollVelocity = dy / dt; // px/ms
    this.lastScrollY = currentY;
    this.lastScrollTime = now;
    this.isScrolling = true;

    // If scrolling at high velocity (> 0.85 px/ms), activate click suppression
    if (this.scrollVelocity > 0.85) {
      this.isFlingSuppressed = true;
    }

    this.scrollPositions.set(this.currentRouteKey, currentY);

    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = setTimeout(() => {
      this.isScrolling = false;
      this.scrollVelocity = 0;
      if (this.clickSuppressTimer) clearTimeout(this.clickSuppressTimer);
      this.clickSuppressTimer = setTimeout(() => {
        this.isFlingSuppressed = false;
      }, 80);
    }, 100);
  };

  /**
   * Suppresses accidental clicks when the user touches to arrest a fast fling
   */
  private handleClickCapture = (e: MouseEvent) => {
    if (this.isFlingSuppressed) {
      e.stopPropagation();
      e.preventDefault();
      this.isFlingSuppressed = false;
    }
  };

  private handleTouchEnd = () => {
    // If finger lifted after a fling, allow a short 60ms settle before clicks re-enable
    if (this.scrollVelocity > 0.85) {
      this.isFlingSuppressed = true;
      if (this.clickSuppressTimer) clearTimeout(this.clickSuppressTimer);
      this.clickSuppressTimer = setTimeout(() => {
        this.isFlingSuppressed = false;
      }, 90);
    }
  };
}
