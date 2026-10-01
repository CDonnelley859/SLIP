import { useId, type ReactNode, type SVGProps } from "react";

/**
 * SLIP mascot: an original 1930s rubber-hose horse ("Slip") with a jockey in harlequin silks.
 * Rubber-hose rules: black bodies with a cream face mask, pie-cut eyes, joint-free hose limbs,
 * white four-finger gloves, big boot hooves, toothy grin, squash-and-stretch bounce.
 * Animation classes live in index.css (.rh-*).
 */

const INK = "var(--ink)";
const CREAM = "var(--cream)";
const PINK = "var(--pink)";
const PINK_DEEP = "var(--pink-deep)";
const WHITE = "#fffaf4";
const GREY = "#8c7f8d";
const GREY_DK = "#6e6270";
const GREY_LT = "#a99dab";
const GOLD = "#e8c84a";
const GOLD_DK = "#c49a3c";

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

/** Thin rubbery grey leg with an ink outline. */
const Leg = ({ d, far = false }: { d: string; far?: boolean }) => (
  <g fill="none" strokeLinecap="round">
    <path d={d} stroke={INK} strokeWidth={17} />
    <path d={d} stroke={far ? GREY_DK : GREY} strokeWidth={10} />
  </g>
);

/** Big puffy gold boot hoof with a cuff, shading and a shine. */
const Hoof = ({ x, y, rot = 0, far = false }: { x: number; y: number; rot?: number; far?: boolean }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={far ? 0.92 : 1}>
    <Solid
      fill={GOLD}
      line={3}
      shapes={() => (
        <>
          <ellipse cx="8" cy="5" rx="21" ry="13" />
          <ellipse cx="-2" cy="-6" rx="11" ry="8" />
        </>
      )}
    />
    <path d="M-12 10 C0 18 20 18 28 8 C26 16 14 20 4 19 C-4 18 -10 15 -12 10 Z" fill={GOLD_DK} />
    <path d="M-11 -4 C-6 0 4 0 9 -4" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M14 -2 Q22 -1 24 5" stroke={WHITE} strokeWidth="3" fill="none" strokeLinecap="round" />
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
  const faceClip = `face${uid}`;
  const bodyClip = `body${uid}`;
  const headClip = `head${uid}`;
  const a = (c: string) => (animate ? c : "");
  const at = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

  return (
    <svg
      viewBox="0 0 400 330"
      width={size}
      height={(size * 330) / 400}
      className={className}
      role="img"
      aria-label="SLIP mascot: a grinning rubber-hose horse with gold hooves galloping, a jockey waving on its back"
      style={{ overflow: "visible", transform: "scaleX(-1)" }}
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
        <clipPath id={bodyClip}>
          <path d="M140 178 C138 150 170 138 205 142 C240 146 266 158 264 186 C262 212 232 220 200 218 C168 216 142 206 140 178 Z" />
        </clipPath>
        <clipPath id={headClip}>
          <path d="M280 76 C298 60 330 68 348 90 C368 98 382 110 378 128 C374 144 350 148 332 142 C310 136 290 120 282 104 C276 94 274 84 280 76 Z" />
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

      <g className={a("rh-bounce")} style={at(200, 300)}>
        {/* tail: black swept-up flame */}
        <g className={a("rh-tail")} style={at(146, 168)}>
          <Solid
            fill={INK}
            line={3}
            shapes={() => (
              <path d="M148 170 C124 156 112 126 92 116 C110 114 122 120 130 128 C124 114 126 100 134 92 C140 116 150 140 164 154 Z" />
            )}
          />
          <path d="M112 118 Q122 120 128 126" stroke={GREY_LT} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>

        {/* far legs */}
        <g className={a("rh-leg-b")} style={at(160, 200)}>
          <Leg d="M160 200 C128 220 168 252 130 270" far />
          <Hoof x={122} y={276} rot={24} far />
        </g>
        <g className={a("rh-leg-a")} style={at(240, 200)}>
          <Leg d="M240 200 C278 214 250 252 290 262" far />
          <Hoof x={298} y={267} rot={-18} far />
        </g>

        {/* body + neck as one silhouette, cel-shaded belly */}
        <Solid
          fill={GREY}
          line={3}
          shapes={() => (
            <>
              <path d="M140 178 C138 150 170 138 205 142 C240 146 266 158 264 186 C262 212 232 220 200 218 C168 216 142 206 140 178 Z" />
              <path d="M228 152 C244 122 262 100 282 84 L306 100 C290 118 274 142 264 172 Z" />
            </>
          )}
        />
        <g clipPath={`url(#${bodyClip})`}>
          <path d="M130 196 C170 214 230 214 270 190 L270 240 L130 240 Z" fill={GREY_DK} />
          <rect x="130" y="186" width="140" height="40" fill={`url(#${dotsInk})`} opacity="0.25" />
        </g>
        {/* mane */}
        <Solid
          fill={INK}
          line={2}
          shapes={() => (
            <path d="M230 152 C238 120 256 96 282 78 C278 90 272 94 268 100 C264 106 256 110 254 118 C248 122 246 132 242 146 Z" />
          )}
        />
        {/* saddle cloth */}
        <Solid
          fill={`url(#${harl})`}
          line={3}
          shapes={() => <path d="M174 146 C190 138 220 138 238 146 L235 170 C218 176 194 176 177 170 Z" />}
        />

        {/* near legs */}
        <g className={a("rh-leg-a")} style={at(176, 206)}>
          <Leg d="M176 206 C148 238 192 262 168 290" />
          <Hoof x={162} y={297} rot={10} />
        </g>
        <g className={a("rh-leg-b")} style={at(226, 208)}>
          <Leg d="M226 208 C256 236 222 270 248 292" />
          <Hoof x={256} y={299} rot={-6} />
        </g>

        {/* head */}
        <g className={a("rh-head")} style={at(262, 150)}>
          {/* ears */}
          <Solid fill={GREY} line={3} shapes={() => (<><path d="M282 78 L272 44 L298 70 Z" /><path d="M294 72 L300 40 L314 70 Z" /></>)} />
          <path d="M282 70 L278 54 L290 66 Z" fill={INK} />
          <path d="M298 66 L301 50 L308 66 Z" fill={INK} />
          {/* long head with big rounded muzzle */}
          <Solid
            fill={GREY}
            line={3}
            shapes={() => (
              <path d="M280 76 C298 60 330 68 348 90 C368 98 382 110 378 128 C374 144 350 148 332 142 C310 136 290 120 282 104 C276 94 274 84 280 76 Z" />
            )}
          />
          <g clipPath={`url(#${headClip})`}>
            <ellipse cx="356" cy="120" rx="30" ry="24" fill={GREY_LT} />
            <path d="M276 104 C300 130 340 150 390 134 L390 160 L270 160 Z" fill={GREY_DK} opacity="0.6" />
          </g>
          {/* wide toothy grin */}
          <Solid
            fill={WHITE}
            line={2.5}
            shapes={() => <path d="M316 120 C332 134 358 136 376 124 C374 134 362 144 344 144 C328 142 318 132 316 120 Z" />}
          />
          <path d="M328 130 L330 139 M340 133 L341 143 M352 134 L352 143 M364 131 L362 140" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M312 114 Q314 122 320 124" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* big nostril on top of the muzzle */}
          <path d="M350 100 Q362 94 368 104" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="364" cy="104" r="2.5" fill={INK} />
          {/* sleepy, contented eye: heavy lid over a white almond */}
          <ellipse cx="308" cy="88" rx="10" ry="7.5" fill={WHITE} stroke={INK} strokeWidth="3" />
          <circle cx="311" cy="91" r="4" fill={INK} />
          <path d="M297 89 C300 76 316 76 319 89 Z" fill={GREY} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M298 76 Q308 70 318 76" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* forelock */}
          <Solid fill={INK} line={2} shapes={() => <path d="M284 74 C288 60 300 58 304 66 C298 66 294 70 292 78 Z" />} />
        </g>

        {/* reins */}
        <path d="M244 128 C270 128 296 122 316 120" stroke={INK} strokeWidth="2.5" fill="none" />

        {/* jockey */}
        <g transform="translate(2 -8)">
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
      </g>
    </svg>
  );
};

export default Mascot;
