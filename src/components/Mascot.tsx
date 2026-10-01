import { useId } from "react";

/**
 * SLIP mascot: an original rubber-hose horse with a jockey in harlequin silks.
 * Flat fills, ink outlines, halftone shading. Gallop loop is CSS (see index.css, .mascot-*).
 */

const INK = "var(--ink)";
const CREAM = "var(--cream)";
const CREAM2 = "var(--cream-2)";
const PINK = "var(--pink)";
const PINK_DEEP = "var(--pink-deep)";
const GREEN = "var(--green)";

/** A noodle limb: ink outline underneath, fill on top. */
const Tube = ({ d, w, fill = CREAM }: { d: string; w: number; fill?: string }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={INK} strokeWidth={w + 8} />
    <path d={d} stroke={fill} strokeWidth={w} />
  </g>
);

const Hoof = ({ cx, cy }: { cx: number; cy: number }) => (
  <ellipse cx={cx} cy={cy} rx="13" ry="10" fill={PINK} stroke={INK} strokeWidth="4" />
);

export const Mascot = ({
  size = 220,
  animate = true,
  className,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const dots = `dots${uid}`;
  const harl = `harl${uid}`;
  const fade = `fade${uid}`;
  const bellyMask = `belly${uid}`;
  const bodyClip = `body${uid}`;
  const A = animate ? "mascot-legs-a" : "";
  const B = animate ? "mascot-legs-b" : "";
  const BODY_D =
    "M64 125 C60 98 110 88 150 92 C190 96 210 118 204 152 C198 184 150 194 108 190 C76 187 66 160 64 125 Z";
  const org = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

  return (
    <svg
      viewBox="0 0 300 260"
      width={size}
      height={(size * 260) / 300}
      className={className}
      role="img"
      aria-label="SLIP mascot: a grinning horse galloping with a jockey on its back"
    >
      <defs>
        <pattern id={dots} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.7" fill={PINK_DEEP} />
        </pattern>
        <pattern id={`${dots}k`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.6" fill={INK} />
        </pattern>
        <pattern id={harl} width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill={GREEN} />
          <polygon points="11,0 22,11 11,22 0,11" fill={PINK} />
        </pattern>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="138" x2="0" y2="192">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask id={bellyMask}>
          <rect x="0" y="0" width="300" height="260" fill={`url(#${fade})`} />
        </mask>
        <clipPath id={bodyClip}>
          <path d={BODY_D} />
        </clipPath>
      </defs>

      {/* ground shadow, halftone */}
      <ellipse cx="140" cy="252" rx="96" ry="7" fill={`url(#${dots}k)`} opacity="0.45" />

      <g className={animate ? "mascot-bob" : ""}>
        {/* tail */}
        <g className={animate ? "mascot-tail" : ""} style={org(68, 128)}>
          <path
            d="M68 126 C40 104 22 122 30 150 C34 164 20 170 14 178 C40 176 54 160 48 146 C44 136 58 136 70 140 Z"
            fill={INK}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M30 150 Q28 138 38 130" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>

        {/* far legs */}
        <g className={A} style={org(84, 170)}>
          <Tube d="M84 170 Q62 200 40 214" w={14} fill={CREAM2} />
          <Hoof cx={36} cy={217} />
        </g>
        <g className={B} style={org(176, 172)}>
          <Tube d="M176 172 Q200 195 226 200" w={14} fill={CREAM2} />
          <Hoof cx={234} cy={201} />
        </g>

        {/* body */}
        <path d={BODY_D} fill={CREAM} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <g clipPath={`url(#${bodyClip})`}>
          <rect x="0" y="0" width="300" height="260" fill={`url(#${dots})`} mask={`url(#${bellyMask})`} />
        </g>
        <path d="M82 138 Q96 120 116 136" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* near legs */}
        <g className={B} style={org(100, 176)}>
          <Tube d="M100 176 Q92 208 96 234" w={14} />
          <Hoof cx={98} cy={240} />
        </g>
        <g className={A} style={org(190, 170)}>
          <Tube d="M190 170 Q205 205 198 234" w={14} />
          <Hoof cx={198} cy={240} />
        </g>

        {/* neck */}
        <Tube d="M190 112 Q218 98 226 66" w={28} />

        {/* mane */}
        <g fill={GREEN} stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <circle cx="198" cy="96" r="9" />
          <circle cx="205" cy="80" r="9" />
          <circle cx="214" cy="64" r="9" />
        </g>

        {/* head */}
        <g>
          <path d="M226 28 L222 6 L240 24 Z" fill={CREAM} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M227 24 L226 14 L234 22 Z" fill={PINK} />
          <ellipse cx="240" cy="50" rx="25" ry="20" transform="rotate(14 240 50)" fill={CREAM} stroke={INK} strokeWidth="5" />
          <ellipse cx="264" cy="64" rx="22" ry="15" transform="rotate(22 264 64)" fill={CREAM} stroke={INK} strokeWidth="5" />
          <ellipse cx="240" cy="50" rx="21" ry="16" transform="rotate(14 240 50)" fill={CREAM} />
          {/* grin */}
          <path d="M246 70 Q266 94 288 70 Q266 78 246 70 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <g fill="#fff">
            <rect x="256" y="72" width="6" height="6" rx="1" />
            <rect x="264" y="74" width="6" height="6" rx="1" />
            <rect x="272" y="73" width="6" height="6" rx="1" />
          </g>
          <circle cx="284" cy="58" r="2.6" fill={INK} />
          {/* eye */}
          <circle cx="246" cy="42" r="10" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <circle cx="249" cy="43" r="4.4" fill={INK} />
          <path d="M236 30 Q246 24 256 32" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* forelock */}
          <path d="M228 34 C222 24 232 16 238 24 C236 30 234 32 228 34 Z" fill={GREEN} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </g>

        {/* jockey */}
        <g className={animate ? "mascot-rider" : ""} style={org(140, 100)}>
          {/* legs */}
          <Tube d="M140 100 Q152 118 174 124" w={13} />
          <circle cx="178" cy="126" r="8" fill={INK} />
          {/* back arm with reins */}
          <path d="M194 104 Q222 94 252 78" stroke={INK} strokeWidth="2.5" fill="none" />
          <Tube d="M150 80 Q172 96 194 104" w={11} fill={`url(#${harl})`} />
          {/* torso */}
          <Tube d="M138 102 Q146 80 160 60" w={30} fill={`url(#${harl})`} />
          {/* head */}
          <circle cx="168" cy="40" r="18" fill={CREAM} stroke={INK} strokeWidth="4.5" />
          <circle cx="174" cy="38" r="3" fill={INK} />
          <circle cx="162" cy="46" r="4" fill={PINK} opacity="0.7" />
          <path d="M165 47 Q173 56 182 47" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          {/* cap */}
          <path d="M150 36 Q152 14 174 17 Q187 20 186 35 Z" fill={PINK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M182 32 L200 36 L184 40 Z" fill={PINK_DEEP} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          {/* waving arm */}
          <g className={animate ? "mascot-arm" : ""} style={org(152, 74)}>
            <Tube d="M152 74 Q124 62 130 30" w={11} fill={`url(#${harl})`} />
            <circle cx="130" cy="22" r="10" fill="#fff" stroke={INK} strokeWidth="3.5" />
            <path d="M122 14 Q110 2 100 12" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
};

export default Mascot;
