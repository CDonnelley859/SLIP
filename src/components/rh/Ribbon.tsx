import type { ReactNode } from "react";

/** Cuphead-style banner ribbon with folded, notched tails. */
const Tail = ({ flip, color }: { flip?: boolean; color: string }) => (
  <svg width="30" height="48" viewBox="0 0 30 48" aria-hidden style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0, marginTop: 10 }}>
    <path d="M30 4 L2 4 L13 24 L2 44 L30 44 Z" fill={color} stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M30 44 L22 36 L22 44 Z" fill="var(--ink)" />
  </svg>
);

export const Ribbon = ({
  children, bg = "var(--pink-pop)", tail = "var(--pink-pop-dark)", size = 16,
}: { children: ReactNode; bg?: string; tail?: string; size?: number }) => (
  <div style={{ display: "inline-flex", alignItems: "flex-start" }}>
    <Tail color={tail} />
    <div
      className="rh-text"
      style={{
        position: "relative", zIndex: 1, margin: "0 -8px",
        background: bg, border: "3.5px solid var(--ink)", borderRadius: 6,
        boxShadow: "3px 4px 0 var(--ink)",
        padding: `${size * 0.55}px ${size}px ${size * 0.35}px`, fontSize: size, lineHeight: 1,
        ["--rh-stroke" as any]: "4px", textShadow: "2px 2px 0 var(--ink)", whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
    <Tail flip color={tail} />
  </div>
);

export default Ribbon;
