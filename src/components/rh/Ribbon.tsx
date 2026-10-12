import type { ReactNode } from "react";

/** Square-cut banner ribbon with notched tails, in the retro inks. */
const Tail = ({ flip, color }: { flip?: boolean; color: string }) => (
  <svg width="26" height="40" viewBox="0 0 26 40" aria-hidden style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0, marginTop: 8 }}>
    <path d="M26 2 L2 2 L11 20 L2 38 L26 38 Z" fill={color} stroke="var(--ink)" strokeWidth="2.67" strokeLinejoin="miter" />
    <path d="M26 38 L19 31 L19 38 Z" fill="var(--ink)" />
  </svg>
);

export const Ribbon = ({
  children, bg = "var(--pink-deep)", tail = "#7d173f", color = "var(--cream)", size = 13,
}: { children: ReactNode; bg?: string; tail?: string; color?: string; size?: number }) => (
  <div style={{ display: "inline-flex", alignItems: "flex-start" }}>
    <Tail color={tail} />
    <div
      className="display"
      style={{
        position: "relative", zIndex: 1, margin: "0 -6px",
        background: bg, color, border: "2.67px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)",
        padding: `${size * 0.6}px ${size}px ${size * 0.45}px`, fontSize: size, lineHeight: 1,
        letterSpacing: "0.06em", whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
    <Tail flip color={tail} />
  </div>
);

export default Ribbon;
