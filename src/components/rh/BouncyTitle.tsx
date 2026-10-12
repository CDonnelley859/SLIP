/** Rubber-hose title: retro Bowlby letters with the pink extrusion, each tilted, lifted, popping in and boiling. */
const TILT = [-7, 5, -4, 8, -6, 4, -3, 6];
const LIFT = [3, -5, 2, -3, 4, -4, 2, -2];

export const BouncyTitle = ({ text, size = 56 }: { text: string; size?: number }) => (
  <span aria-label={text} style={{ display: "inline-flex", gap: size * 0.03 }}>
    {Array.from(text).map((ch, i) => (
      <span key={i} aria-hidden className="rh-pop" style={{ display: "inline-block", animationDelay: `${i * 0.07}s`, ["--r" as any]: `${TILT[i % TILT.length]}deg` }}>
        <span
          className="display-extruded rh-jitter"
          style={{
            display: "inline-block", fontSize: size, lineHeight: 1, color: "var(--cream)",
            ["--r" as any]: `${TILT[i % TILT.length]}deg`, ["--y" as any]: `${LIFT[i % LIFT.length]}px`,
            animationDelay: `${-i * 0.13}s`,
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      </span>
    ))}
  </span>
);

export default BouncyTitle;
