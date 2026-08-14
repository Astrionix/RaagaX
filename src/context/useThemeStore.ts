import { create } from 'zustand';

export type AppTheme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: AppTheme) => void;
  initThemeListener: () => () => void;
}

const THEME_STORAGE_KEY = 'raagax_theme_preference';

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {}
  return 'system';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getStoredTheme(),
  resolvedTheme: (() => {
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  })(),

  setTheme: (newTheme: AppTheme) => {
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(resolved);
      root.setAttribute('data-theme', resolved);
      root.style.colorScheme = resolved;
    }

    set({ theme: newTheme, resolvedTheme: resolved });
  },

  initThemeListener: () => {
    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyCurrent = () => {
      const currentTheme = get().theme;
      const resolved = currentTheme === 'system' 
        ? (mediaQuery.matches ? 'dark' : 'light')
        : currentTheme;

      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(resolved);
      root.setAttribute('data-theme', resolved);
      root.style.colorScheme = resolved;

      set({ resolvedTheme: resolved });
    };

    // Apply on startup
    applyCurrent();

    // Listen for mobile/system dark mode toggle events
    const handleChange = (e: MediaQueryListEvent) => {
      if (get().theme === 'system') {
        const nextResolved = e.matches ? 'dark' : 'light';
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(nextResolved);
        root.setAttribute('data-theme', nextResolved);
        root.style.colorScheme = nextResolved;

        set({ resolvedTheme: nextResolved });
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  },
}));
