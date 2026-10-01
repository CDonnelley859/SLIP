import { useId, type ReactNode, type SVGProps } from "react";

/**
 * SLIP mascot: an original 1930s rubber-hose horse ("Slip") with a jockey in harlequin silks.
 * Rubber-hose rules: black bodies with a cream face mask, pie-cut eyes, joint-free hose limbs,
 * white four-finger gloves, big boot hooves, toothy grin, squash-and-stretch bounce.
 * Animation classes live in index.css (.rh-*).
 */

const INK = "var(--ink)";
const CREAM = "var(--cream)";
const CREAM2 = "var(--cream-2)";
const PINK = "var(--pink)";
const PINK_DEEP = "var(--pink-deep)";
const WHITE = "#fffaf4";

type Shapes = (p: SVGProps<SVGElement>) => ReactNode;

/** Draw a compound shape as one silhouette: thick ink pass underneath, flat fill on top. */
const Solid = ({ shapes, fill, line = 4.5 }: { shapes: Shapes; fill: string; line?: number }) => (
  <g strokeLinejoin="round" strokeLinecap="round">
    <g fill={INK} stroke={INK} strokeWidth={line * 2}>{shapes({})}</g>
    <g fill={fill} stroke="none">{shapes({})}</g>
  </g>
);

/** Joint-free rubber hose limb. */
const Hose = ({ d, w = 11, color = INK }: { d: string; w?: number; color?: string }) => (
  <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
);

/** Pie-cut eye: tall white oval, black pill pupil with a wedge notch. */
const PieEye = ({ cx, cy, rx = 9, ry = 15, look = 2 }: { cx: number; cy: number; rx?: number; ry?: number; look?: number }) => (
  <g>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={WHITE} stroke={INK} strokeWidth="4" />
    <ellipse cx={cx + look} cy={cy + ry * 0.12} rx={rx * 0.58} ry={ry * 0.68} fill={INK} />
    <path
      d={`M${cx + look + rx * 0.05} ${cy - ry * 0.18} L${cx + look + rx * 0.62} ${cy - ry * 0.42} L${cx + look + rx * 0.6} ${cy - ry * 0.05} Z`}
      fill={WHITE}
    />
  </g>
);

/** Four-finger cartoon glove with rolled cuff, drawn at the origin pointing up. */
const Glove = ({ x, y, rot = 0, scale = 1 }: { x: number; y: number; rot?: number; scale?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
    <Solid
      fill={WHITE}
      line={3.2}
      shapes={() => (
        <>
          <ellipse cx="-7" cy="-11" rx="4.2" ry="7.5" />
          <ellipse cx="0" cy="-14" rx="4.4" ry="8" />
          <ellipse cx="7" cy="-11" rx="4.2" ry="7.5" />
          <ellipse cx="-12" cy="1" rx="4.2" ry="6.5" transform="rotate(-45 -12 1)" />
          <circle cx="0" cy="0" r="10.5" />
          <rect x="-9" y="8" width="18" height="9" rx="4" />
        </>
      )}
    />
    <path d="M-4 -6 L-4 -1 M3 -7 L3 -1" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M-8 12.5 H8" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
  </g>
);

/** Big bulbous boot hoof with a pink cuff and a shine. */
const Boot = ({ x, y, rot = 0, far = false }: { x: number; y: number; rot?: number; far?: boolean }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <Solid
      fill={far ? CREAM2 : CREAM}
      shapes={() => (
        <>
          <ellipse cx="6" cy="4" rx="19" ry="11.5" />
          <rect x="-8" y="-9" width="16" height="10" rx="4" />
        </>
      )}
    />
    <rect x="-8" y="-9" width="16" height="7" rx="3.5" fill={PINK} />
    <path d="M10 -1 Q17 -1 19 4" stroke={WHITE} strokeWidth="3" fill="none" strokeLinecap="round" />
  </g>
);

export const Mascot = ({
  size = 260,
  animate = true,
  className,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const harl = `harl${uid}`;
  const dots = `dots${uid}`;
  const dotsInk = `dotsk${uid}`;
  const snoutClip = `snout${uid}`;
  const faceClip = `face${uid}`;
  const a = (c: string) => (animate ? c : "");
  const at = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

  return (
    <svg
      viewBox="0 0 400 330"
      width={size}
      height={(size * 330) / 400}
      className={className}
      role="img"
      aria-label="SLIP mascot: a grinning rubber-hose horse galloping with a waving jockey"
      style={{ overflow: "visible" }}
    >
      <defs>
        <pattern id={harl} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <rect width="18" height="18" fill="var(--green)" />
          <polygon points="9,0 18,9 9,18 0,9" fill={PINK} />
        </pattern>
        <pattern id={dots} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.25" fill={PINK_DEEP} />
        </pattern>
        <pattern id={dotsInk} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.6" fill={INK} />
        </pattern>
        <clipPath id={snoutClip}>
          <ellipse cx="350" cy="110" rx="44" ry="30" transform="rotate(18 350 110)" />
        </clipPath>
        <clipPath id={faceClip}>
          <circle cx="212" cy="44" r="24" />
        </clipPath>
      </defs>

      {/* ground shadow + dust puffs */}
      <ellipse cx="190" cy="318" rx="130" ry="8" fill={`url(#${dotsInk})`} opacity="0.5" />
      <g fill={CREAM} stroke={INK} strokeWidth="3.5">
        <g className={a("rh-puff")} style={{ ...at(48, 296), animationDelay: "0s" }}>
          <circle cx="40" cy="298" r="11" /><circle cx="55" cy="292" r="8" /><circle cx="30" cy="290" r="7" />
        </g>
        <g className={a("rh-puff")} style={{ ...at(20, 276), animationDelay: "-0.22s" }}>
          <circle cx="16" cy="276" r="8" /><circle cx="27" cy="270" r="6" />
        </g>
      </g>
      {/* speed lines */}
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" className={a("rh-speed")}>
        <path d="M18 196 H48" /><path d="M6 222 H40" /><path d="M24 248 H52" />
      </g>

      <g className={a("rh-bounce")} style={at(190, 300)}>
        {/* tail: hose with a tuft */}
        <g className={a("rh-tail")} style={at(114, 176)}>
          <Hose d="M116 178 C92 168 90 136 72 120" w={13} />
          <Solid
            fill={INK}
            shapes={() => (
              <path d="M74 124 C58 124 46 112 50 98 C56 106 62 106 66 102 C60 92 64 80 74 78 C72 88 76 94 82 96 C84 86 92 82 100 86 C92 92 92 104 86 116 C84 122 80 124 74 124 Z" />
            )}
          />
          <path d="M60 100 Q62 92 68 90" stroke={WHITE} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>

        {/* far legs */}
        <g className={a("rh-leg-b")} style={at(126, 222)}>
          <Hose d="M126 222 C104 246 84 238 66 260" />
          <Boot x={60} y={266} rot={30} far />
        </g>
        <g className={a("rh-leg-a")} style={at(238, 230)}>
          <Hose d="M238 230 C244 266 272 282 274 300" />
          <Boot x={280} y={304} rot={-6} far />
        </g>

        {/* body */}
        <Solid
          fill={INK}
          shapes={() => (
            <path d="M108 192 C102 152 160 136 208 140 C258 144 288 166 282 202 C276 236 226 248 180 245 C134 242 112 226 108 192 Z" />
          )}
        />
        <path d="M140 156 Q170 142 204 146" stroke={WHITE} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M150 168 Q160 162 172 162" stroke={WHITE} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />

        {/* near legs */}
        <g className={a("rh-leg-a")} style={at(142, 228)}>
          <Hose d="M142 228 C132 262 104 264 86 288" />
          <Boot x={78} y={294} rot={24} />
        </g>
        <g className={a("rh-leg-b")} style={at(252, 226)}>
          <Hose d="M252 226 C268 258 302 256 318 282" />
          <Boot x={324} y={288} rot={-14} />
        </g>

        {/* neck + head */}
        <g className={a("rh-head")} style={at(258, 170)}>
          <Hose d="M252 172 C268 150 286 128 296 96" w={34} />
          {/* ears */}
          <Solid fill={INK} shapes={() => (<><path d="M280 52 C270 30 276 16 286 22 C292 32 292 44 290 54 Z" /><path d="M298 48 C296 26 306 14 314 22 C316 34 312 44 306 52 Z" /></>)} />
          <path d="M282 44 C278 34 280 28 284 30" stroke={PINK} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M302 42 C302 32 306 26 309 29" stroke={PINK} strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* skull + snout as one silhouette */}
          <Solid
            fill={INK}
            shapes={() => <circle cx="300" cy="80" r="34" />}
          />
          <Solid
            fill={CREAM}
            shapes={() => (
              <>
                <ellipse cx="350" cy="110" rx="44" ry="30" transform="rotate(18 350 110)" />
                <ellipse cx="318" cy="72" rx="20" ry="24" />
              </>
            )}
          />
          {/* halftone shading under the snout */}
          <g clipPath={`url(#${snoutClip})`}>
            <rect x="300" y="112" width="100" height="40" fill={`url(#${dots})`} />
          </g>
          {/* grin */}
          <Solid
            fill={INK}
            line={2.5}
            shapes={() => <path d="M320 112 C334 140 372 146 392 118 C370 128 340 124 320 112 Z" />}
          />
          <path d="M346 132 C352 140 366 141 374 134 C366 130 354 130 346 132 Z" fill={PINK} />
          <path d="M328 118 C344 126 368 128 388 122 L386 128 C366 134 344 132 330 124 Z" fill={WHITE} />
          <path d="M346 125 V131 M360 127 V133 M374 126 V131" stroke={INK} strokeWidth="2" />
          {/* nostrils + nose shine */}
          <ellipse cx="380" cy="100" rx="3.5" ry="5" fill={INK} transform="rotate(20 380 100)" />
          <ellipse cx="368" cy="96" rx="3" ry="4.5" fill={INK} transform="rotate(20 368 96)" />
          {/* pie eyes */}
          <PieEye cx={310} cy={64} look={1} />
          <PieEye cx={329} cy={68} look={1} />
          {/* forelock */}
          <Solid fill={INK} line={3} shapes={() => <path d="M292 50 C300 34 316 36 318 46 C310 42 304 46 300 54 Z" />} />
        </g>

        {/* reins */}
        <path d="M244 134 C276 132 312 118 336 116" stroke={INK} strokeWidth="2.5" fill="none" />

        {/* jockey */}
        <g className={a("rh-rider")} style={at(190, 148)}>
          {/* leg + boot */}
          <Hose d="M184 146 C206 152 214 170 216 190" w={20} />
          <Hose d="M184 146 C206 152 214 170 216 190" w={11} color={WHITE} />
          <Solid fill={INK} shapes={() => <ellipse cx="224" cy="194" rx="13" ry="8" />} />
          <path d="M222 189 Q230 189 233 193" stroke={WHITE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* rein arm */}
          <Hose d="M200 112 C214 126 228 134 244 134" w={9} />
          <Glove x={246} y={132} rot={100} scale={0.8} />
          {/* torso: pear of harlequin silks */}
          <Solid
            fill={`url(#${harl})`}
            shapes={() => <path d="M176 152 C166 132 176 104 196 98 C212 94 220 106 214 124 C208 142 200 154 176 152 Z" />}
          />
          {/* long rubber neck + head */}
          <g className={a("rh-neck")} style={at(204, 100)}>
            <Hose d="M204 100 C202 88 206 76 208 66" w={8} color={INK} />
            <Hose d="M204 100 C202 88 206 76 208 66" w={3.5} color={CREAM} />
            <Solid fill={CREAM} shapes={() => <><circle cx="212" cy="44" r="24" /><circle cx="190" cy="48" r="7" /></>} />
            <g clipPath={`url(#${faceClip})`}>
              <rect x="186" y="54" width="52" height="16" fill={`url(#${dots})`} />
            </g>
            <PieEye cx={214} cy={40} rx={6} ry={10} look={1.5} />
            <PieEye cx={227} cy={41} rx={6} ry={10} look={1.5} />
            {/* big round nose */}
            <Solid fill={PINK} line={3} shapes={() => <circle cx="234" cy="52" r="7" />} />
            <circle cx="236" cy="50" r="2" fill={WHITE} />
            {/* grin */}
            <path d="M210 56 C214 66 228 68 234 62" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {/* jockey cap with pompom */}
            <Solid
              fill={PINK}
              shapes={() => (
                <>
                  <path d="M190 36 C188 14 228 8 236 30 Z" />
                  <path d="M228 28 C240 26 252 30 254 34 C244 36 234 36 228 34 Z" />
                  <circle cx="212" cy="12" r="5" />
                </>
              )}
            />
            <path d="M196 30 C200 20 214 16 224 20" stroke={WHITE} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
          {/* waving arm */}
          <g className={a("rh-wave")} style={at(184, 112)}>
            <Hose d="M184 112 C164 108 156 90 164 64" w={9} />
            <Glove x={165} y={56} rot={-14} />
          </g>
        </g>
      </g>
    </svg>
  );
};

export default Mascot;
