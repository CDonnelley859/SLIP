import { useMemo } from "react";

/** Deterministic serial like AA1234567 from any string. */
export const serialFor = (seed: string) => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0;
  const letters = String.fromCharCode(65 + (h % 26)) + String.fromCharCode(65 + ((h >> 5) % 26));
  return `${letters}${String(h % 10_000_000).padStart(7, "0")}`;
};

/** Barcode bars derived from the serial, so a slip always prints the same code. */
const Barcode = ({ serial, color }: { serial: string; color: string }) => {
  const bars = useMemo(() => {
    const out: { x: number; w: number }[] = [];
    let x = 0;
    for (let i = 0; i < 40; i++) {
      const c = serial.charCodeAt(i % serial.length) + i * 7;
      const w = 1 + (c % 3);
      if (i % 2 === 0) out.push({ x, w });
      x += w + 1;
    }
    return { out, width: x };
  }, [serial]);
  return (
    <svg viewBox={`0 0 ${bars.width} 28`} width="100%" height="28" preserveAspectRatio="none" aria-hidden>
      {bars.out.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="28" fill={color} />)}
    </svg>
  );
};

/**
 * Tear-off stub for the bottom of a slip: dashed tear line with side bites,
 * a harlequin silks band, ADMIT ONE, serial and barcode.
 * `edge` is the ticket's outline colour, `bg` the ticket ground (for the bites).
 */
export const TicketStub = ({
  seed, bg = "var(--green)", edge = "rgba(245,232,223,0.4)", ink = "var(--cream)", label = "ADMIT ONE",
}: { seed: string; bg?: string; edge?: string; ink?: string; label?: string }) => {
  const serial = serialFor(seed);
  const bite = { width: 18, height: 18, borderRadius: "50%", background: "var(--green)", border: `3px solid ${edge}`, flexShrink: 0 } as const;
  return (
    <div style={{ margin: "20px -18px -22px", color: ink }}>
      {/* tear line with bites cut into both sides */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ ...bite, marginLeft: -12, clipPath: "inset(0 0 0 50%)" }} />
        <div className="perf" style={{ flex: 1, opacity: 0.8 }} />
        <div style={{ ...bite, marginRight: -12, clipPath: "inset(0 50% 0 0)" }} />
      </div>
      {/* stub */}
      <div className="halftone-shade" style={{ display: "flex", background: bg, ["--dot" as any]: "rgba(0,0,0,0.35)", ["--fade" as any]: "top" }}>
        <div className="harlequin harlequin-sm" style={{ width: 34, borderRight: `3px solid ${edge}` }} aria-hidden />
        <div style={{ flex: 1, padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="display-extruded" style={{ fontSize: 22, ["--ext" as any]: "var(--pink-deep)" }}>{label}</span>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.12em" }}>{serial}</span>
          </div>
          <Barcode serial={serial} color={ink} />
        </div>
        <div className="harlequin harlequin-sm" style={{ width: 34, borderLeft: `3px solid ${edge}` }} aria-hidden />
      </div>
    </div>
  );
};

export default TicketStub;
