import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

describe('RaagaX NavigationStack — iPad & Desktop Navigation Suite', () => {
  beforeEach(() => {
    NavigationStack.getInstance().resetToInitial('home');
  });

  it('1. Initializes with root home entry and canGoBack=false, canGoForward=false', () => {
    const nav = NavigationStack.getInstance();
    expect(nav.getCurrent()?.activeTab).toBe('home');
    expect(nav.canGoBack()).toBe(false);
    expect(nav.canGoForward()).toBe(false);
  });

  it('2. Pushing routes enables canGoBack and clears forward stack', () => {
    const nav = NavigationStack.getInstance();

    nav.push({
      activeTab: 'search',
      selectedAlbumId: null,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });

    expect(nav.getCurrent()?.activeTab).toBe('search');
    expect(nav.canGoBack()).toBe(true);
    expect(nav.canGoForward()).toBe(false);

    nav.push({
      activeTab: 'album',
      selectedAlbumId: 'alb_123',
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });

    expect(nav.getCurrent()?.selectedAlbumId).toBe('alb_123');
    expect(nav.getStack().length).toBe(3);
  });

  it('3. Going back pushes popped entries to forward stack and enables canGoForward', () => {
    const nav = NavigationStack.getInstance();

    nav.push({
      activeTab: 'search',
      selectedAlbumId: null,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });

    nav.push({
      activeTab: 'artist',
      selectedAlbumId: null,
      selectedArtistId: 'art_456',
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });

    let callbackTarget: any = null;
    const handled = nav.goBack((target) => {
      callbackTarget = target;
    });

    expect(handled).toBe(true);
    expect(callbackTarget.activeTab).toBe('search');
    expect(nav.getCurrent()?.activeTab).toBe('search');
    expect(nav.canGoForward()).toBe(true);
    expect(nav.canGoBack()).toBe(true);

    // Go forward
    let forwardTarget: any = null;
    const forwardHandled = nav.goForward((target) => {
      forwardTarget = target;
    });

    expect(forwardHandled).toBe(true);
    expect(forwardTarget.selectedArtistId).toBe('art_456');
    expect(nav.getCurrent()?.selectedArtistId).toBe('art_456');
    expect(nav.canGoForward()).toBe(false);
  });

  it('4. Subscribers are notified on navigation pushes, back, forward, and reset', () => {
    const nav = NavigationStack.getInstance();
    let notifyCount = 0;

    const unsubscribe = nav.subscribe(() => {
      notifyCount++;
    });

    nav.push({
      activeTab: 'favorites',
      selectedAlbumId: null,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });
    expect(notifyCount).toBe(1);

    nav.goBack();
    expect(notifyCount).toBe(2);

    nav.goForward();
    expect(notifyCount).toBe(3);

    nav.resetToInitial('home');
    expect(notifyCount).toBe(4);

    unsubscribe();
    nav.push({
      activeTab: 'library',
      selectedAlbumId: null,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });
    expect(notifyCount).toBe(4); // Did not increment after unsubscribe
  });
});
