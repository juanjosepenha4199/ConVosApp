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

/** GIF decorativo pequeño (Giphy); alt vacío porque es puramente ornamental. */
export function ConvosPartyGif({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ring-2 ring-white/90 shadow-lg ${className}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif"
        alt=""
        width={160}
        height={120}
        className="h-28 w-full object-cover sm:h-32"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
