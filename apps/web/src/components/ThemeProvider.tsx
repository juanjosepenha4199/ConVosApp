'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ConvosTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: ConvosTheme;
  setTheme: (t: ConvosTheme) => void;
  toggle: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ConvosTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return localStorage.getItem('convos-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyDomTheme(t: ConvosTheme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ConvosTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readStoredTheme();
    setThemeState(t);
    applyDomTheme(t);
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: ConvosTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem('convos-theme', t);
    } catch {
      /* ignore */
    }
    applyDomTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('convos-theme', next);
      } catch {
        /* ignore */
      }
      applyDomTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, mounted }),
    [theme, setTheme, toggle, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <ThemeToggleFab />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

/** Botón flotante: visible en toda la app */
function ThemeToggleFab() {
  const { theme, toggle, mounted } = useTheme();

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => toggle()}
      className="convos-theme-fab fixed bottom-5 right-5 z-[280] flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-lg transition-[transform,box-shadow] duration-200 ease-out hover:scale-105 md:bottom-6 md:right-6"
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <span aria-hidden className="select-none leading-none">
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
