'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type CelebrationPayload = {
  title: string;
  message: string;
  emoji?: string;
  /** Cierre automático en ms; usa `0` para cerrar solo con el botón. */
  durationMs?: number;
  actionLabel?: string;
};

type ShowCelebration = (p: CelebrationPayload) => void;

const CelebrationContext = createContext<ShowCelebration>(() => {});

const DEFAULT_DURATION_MS = 4500;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const timerRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const show = useCallback(
    (p: CelebrationPayload) => {
      generationRef.current += 1;
      const gen = generationRef.current;
      clearTimer();
      setPayload(p);
      setOpen(true);
      const d = p.durationMs ?? DEFAULT_DURATION_MS;
      if (d > 0) {
        timerRef.current = window.setTimeout(() => {
          if (generationRef.current === gen) dismiss();
        }, d);
      }
    },
    [clearTimer, dismiss],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {open && payload ? (
        <div
          className="convos-celebrate-backdrop fixed inset-0 z-[320] flex items-center justify-center overflow-y-auto bg-slate-900/45 dark:bg-black/65 p-4 backdrop-blur-md"
          onClick={dismiss}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="convos-celebration-title"
            className="convos-celebrate-panel relative mx-auto w-full max-w-[min(100%,24rem)] rounded-[1.85rem] border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 p-8 text-center shadow-[0_28px_90px_-28px_rgba(255,46,46,0.35)] ring-1 ring-red-500/25"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="convos-celebrate-emoji mb-5 text-[3.25rem] leading-none drop-shadow-sm"
              aria-hidden
            >
              {payload.emoji ?? '✨'}
            </div>
            <h2 id="convos-celebration-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {payload.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{payload.message}</p>
            <button type="button" className="convos-btn-primary mt-9 w-full px-6 py-3.5 text-sm" onClick={dismiss}>
              {payload.actionLabel ?? 'Genial'}
            </button>
          </div>
        </div>
      ) : null}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  return useContext(CelebrationContext);
}
