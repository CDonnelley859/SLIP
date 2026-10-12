/** Cuphead-style title card lettering: each letter tilts, sits off the baseline, pops in and boils. */
const TILT = [-8, 6, -4, 9, -6, 5, -3, 7];
const LIFT = [4, -6, 2, -3, 5, -4, 3, -2];

export const CartoonTitle = ({ text, size = 64, stroke, color = "var(--cream)" }: { text: string; size?: number; stroke?: number; color?: string }) => (
  <span aria-label={text} role="heading" aria-level={1} style={{ display: "inline-flex", gap: size * 0.02 }}>
    {Array.from(text).map((ch, i) => (
      <span key={i} aria-hidden className="rh-pop" style={{ display: "inline-block", animationDelay: `${i * 0.07}s`, ["--r" as any]: `${TILT[i % TILT.length]}deg` }}>
        <span
          className="rh-text rh-jitter"
          style={{
            display: "inline-block", fontSize: size, lineHeight: 1, color,
            ["--rh-stroke" as any]: `${stroke ?? Math.round(size / 8)}px`,
            ["--r" as any]: `${TILT[i % TILT.length]}deg`,
            ["--y" as any]: `${LIFT[i % LIFT.length]}px`,
            textShadow: `${Math.round(size / 16)}px ${Math.round(size / 13)}px 0 var(--ink)`,
            animationDelay: `${-i * 0.13}s`,
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      </span>
    ))}
  </span>
);

export default CartoonTitle;
