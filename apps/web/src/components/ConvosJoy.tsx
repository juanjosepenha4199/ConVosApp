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
      className={`relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-200/90 via-violet-100 to-cyan-100 ring-2 ring-white/90 shadow-lg sm:h-32 ${className}`}
      aria-hidden
    >
      <span className="text-4xl sm:text-5xl">🎉</span>
    </div>
  );
}
