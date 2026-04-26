"use client";

type FakeCursorProps = {
  visible: boolean;
  /** Viewport X/Y for pointer tip (fixed position). */
  x: number;
  y: number;
  clicking: boolean;
  /** Shown next to the pointer. */
  caption?: string;
};

/**
 * Scripted “demo theater” pointer — not real automation.
 */
export function FakeCursor({ visible, x, y, clicking, caption }: FakeCursorProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-[2147483640]"
      style={{ left: x, top: y, transform: "translate(0, 0)" }}
      aria-hidden
    >
      <div className="relative flex items-start gap-0">
        <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-lg" fill="none">
          <path
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 00-.85.36z"
            fill="white"
            stroke="rgba(15,23,42,0.9)"
            strokeWidth="1.2"
          />
        </svg>
        {clicking ? (
          <span
            className="absolute -left-1 -top-1 h-10 w-10 rounded-full border-2 border-indigo-400/90 bg-indigo-400/20 animate-ping"
            style={{ animationDuration: "0.6s" }}
          />
        ) : null}
        {caption ? (
          <div className="ml-1 mt-4 max-w-[220px] rounded-lg border border-indigo-400/50 bg-slate-950/95 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-indigo-100 shadow-xl">
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
}
