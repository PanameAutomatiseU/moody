import type { LineInfo } from "@/lib/types";

type GlyphProps = { className?: string };
const base = "h-[18px] w-[18px]";

export function WalkGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`}>
      <circle cx="13" cy="4" r="1.6" />
      <path d="M11 21l1.5-5 1.5-3 1 2 2 1" />
      <path d="M14 13l-1.2-3.2a1.6 1.6 0 00-2.9-.2L8 13l-1 4" />
    </svg>
  );
}

export function BikeGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`}>
      <circle cx="6" cy="16.5" r="3.2" />
      <circle cx="18" cy="16.5" r="3.2" />
      <path d="M6 16.5l4-7h5l-2.2 7M9.5 9.5h3.5M15 9.5l1.8 7" />
      <circle cx="12.5" cy="6" r="0.6" />
    </svg>
  );
}

export function TrainGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`}>
      <rect x="6" y="3.5" width="12" height="13" rx="3" />
      <path d="M6 11h12" />
      <circle cx="9.2" cy="13.6" r="0.5" />
      <circle cx="14.8" cy="13.6" r="0.5" />
      <path d="M8.5 16.5L7 20M15.5 16.5L17 20" />
    </svg>
  );
}

export function TransferGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`}>
      <path d="M5 8h12l-3-3M19 16H7l3 3" />
    </svg>
  );
}

export function PinGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ""}`}>
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Official-style line badge: a coloured disc (metro) or rounded square (RER). */
export function LineBadge({ line, size = 26 }: { line: LineInfo; size?: number }) {
  const isRer = line.mode === "rer";
  return (
    <span
      className="inline-flex items-center justify-center font-bold leading-none"
      style={{
        width: size,
        height: size,
        background: line.color,
        color: line.text,
        borderRadius: isRer ? size * 0.28 : "9999px",
        fontSize: size * (line.label.length > 2 ? 0.4 : 0.52),
        letterSpacing: "-0.02em",
      }}
      aria-label={`${isRer ? "RER" : "Ligne"} ${line.label}`}
    >
      {line.label}
    </span>
  );
}
