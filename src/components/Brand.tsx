/** KNDL (said "candle") — the wordmark with a small flame, and the New Thing Media line. */
export function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block">
      <path d="M12 2c3.2 3.8 5 6.4 5 9.6a5 5 0 0 1-10 0C7 8.4 8.8 5.8 12 2Z" fill="var(--accent)" />
      <path d="M12 7.5c1.5 1.9 2.3 3.2 2.3 4.6a2.3 2.3 0 0 1-4.6 0c0-1.4.8-2.7 2.3-4.6Z" fill="#ffc46b" />
      <rect x="9" y="17.5" width="6" height="5" rx="1.2" fill="currentColor" opacity=".8" />
    </svg>
  );
}

export function Wordmark({ size = 20, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 font-serif font-bold leading-tight tracking-[0.08em] text-ink" style={{ fontSize: size }}>
        <Flame size={Math.round(size * 0.95)} />
        KNDL
      </div>
      {tagline && <div className="text-[11px] text-muted">A New Thing Media product</div>}
    </div>
  );
}
