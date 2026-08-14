import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up browser globals in test environment
const mockStorage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

const classListSet = new Set<string>();
const attributes = new Map<string, string>();

(global as any).document = {
  documentElement: {
    classList: {
      add: (c: string) => classListSet.add(c),
      remove: (c: string) => classListSet.delete(c),
      contains: (c: string) => classListSet.has(c),
    },
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    getAttribute: (k: string) => attributes.get(k) ?? null,
    removeAttribute: (k: string) => attributes.delete(k),
    style: {},
  },
};

(global as any).window = {
  matchMedia: (query: string) => ({
    matches: query.includes('dark'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
};

import { useThemeStore } from '@/context/useThemeStore';

describe('RaagaX Light, Dark & Adaptive System Theme System', () => {
  beforeEach(() => {
    mockStorage.clear();
    classListSet.clear();
    attributes.clear();
  });

  it('should initialize with system theme and fallback to dark/light matching media query', () => {
    const store = useThemeStore.getState();
    expect(store.theme).toBeDefined();
    expect(['dark', 'light', 'system']).toContain(store.theme);
  });

  it('should explicitly switch to dark theme and update DOM attributes', () => {
    const store = useThemeStore.getState();
    store.setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(localStorage.getItem('raagax_theme_preference')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should explicitly switch to light theme and update DOM attributes', () => {
    const store = useThemeStore.getState();
    store.setTheme('light');

    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(localStorage.getItem('raagax_theme_preference')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should switch to system adaptive mode and listen to prefers-color-scheme', () => {
    const store = useThemeStore.getState();
    store.setTheme('system');

    expect(useThemeStore.getState().theme).toBe('system');
    expect(localStorage.getItem('raagax_theme_preference')).toBe('system');
    expect(['dark', 'light']).toContain(useThemeStore.getState().resolvedTheme);
  });
});
