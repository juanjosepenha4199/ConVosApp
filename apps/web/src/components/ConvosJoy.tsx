'use client';

const STICKERS = ['💜', '✨', '🎉', '☕', '🌟', '💐', '📸'];

type ConvosJoyProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function ConvosJoy({ className = '', size = 'md' }: ConvosJoyProps) {
  const text =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl md:text-4xl' : 'text-2xl';
  return (
    <div className={`convos-joy-row ${className}`} aria-hidden>
      {STICKERS.map((emoji, i) => (
        <span
          key={`${emoji}-${i}`}
          className={`convos-sticker-bounce inline-block ${text}`}
          style={{ animationDelay: `${i * 0.12}s` }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

/** Bloque decorativo ligero (sin red externa) para no competir con las peticiones de la API. */
export function ConvosPartyGif({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/80 via-zinc-950 to-black shadow-[0_0_32px_-8px_rgba(255,46,46,0.5)] ring-1 ring-white/5 sm:h-32 ${className}`}
      aria-hidden
    >
      <span className="text-4xl drop-shadow-[0_0_12px_rgba(255,80,80,0.8)] sm:text-5xl">🎉</span>
    </div>
  );
}
