'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error';

type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastContextValue = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastContextValue>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-[min(100%,24rem)] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1 transition-opacity duration-300 backdrop-blur-xl active:scale-[0.98] ${
              t.tone === 'success'
                ? 'border border-emerald-200/80 bg-emerald-50/95 text-emerald-900 ring-emerald-200/60 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/20'
                : 'border border-red-200/90 bg-red-50/95 text-red-900 ring-red-200/70 dark:border-red-500/30 dark:bg-red-950/80 dark:text-red-100 dark:ring-red-500/25'
            }`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
