/**
 * SlipIllustration
 * ─────────────────────────────────────────────────────────
 * Six cream line-art SVG scenes, one per ticket.
 * Virtual tracks always get the circuit design.
 * All other tracks get a consistent scene derived from
 * the track name (same name → same scene every time).
 */

import React from "react";

const C  = "rgba(245,232,223,0.6)";   // cream strokes / fills
const CS = "rgba(245,232,223,0.9)";   // bright accent
const CF = "rgba(245,232,223,0.08)";  // very faint fill

// ── Deterministic hash ─────────────────────────────────────
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ── 1. Rolling Countryside ────────────────────────────────
const RollingHills: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* sky gradient suggestion — distant hills */}
    <path d="M0,52 Q55,18 110,40 Q165,60 220,30 Q275,8 360,38 L360,68 L0,68 Z"
      fill={CF} stroke={C} strokeWidth="1.5" />
    {/* near ground */}
    <path d="M0,60 Q90,52 180,58 Q270,64 360,58 L360,68 L0,68 Z"
      fill="rgba(245,232,223,0.05)" />
    {/* fence posts */}
    {[22, 50, 78, 106, 134].map(x => (
      <line key={x} x1={x} y1={55} x2={x} y2={68} stroke={C} strokeWidth="1.5" strokeLinecap="round" />
    ))}
    {/* fence rails */}
    <line x1="16" y1="59" x2="140" y2="57" stroke={C} strokeWidth="1" />
    <line x1="16" y1="63" x2="140" y2="61" stroke={C} strokeWidth="1" />
    {/* galloping horse (translate to mid-right) */}
    <g transform="translate(195,22)" opacity="0.75">
      {/* body */}
      <ellipse cx="20" cy="20" rx="20" ry="10" fill={CS} />
      {/* neck */}
      <path d="M32,13 L38,5 L43,9 L37,15 Z" fill={CS} />
      {/* head */}
      <ellipse cx="44" cy="5" rx="7" ry="5" fill={CS} />
      {/* ear */}
      <path d="M41,1 L44,-2 L47,1" stroke={CS} strokeWidth="1.5" fill="none" />
      {/* legs – galloping splay */}
      <line x1="7"  y1="28" x2="0"  y2="42" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="29" x2="6"  y2="44" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="25" y1="28" x2="32" y2="42" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="31" y1="27" x2="40" y2="40" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      {/* tail */}
      <path d="M1,18 Q-9,12 -7,4" stroke={CS} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* jockey cap hint */}
      <ellipse cx="44" cy="1" rx="9" ry="3" fill={C} />
    </g>
    {/* sun */}
    <circle cx="326" cy="16" r="9" fill="none" stroke={C} strokeWidth="1.5" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
      const r = Math.PI * deg / 180;
      return <line key={deg} x1={326 + Math.cos(r) * 12} y1={16 + Math.sin(r) * 12}
        x2={326 + Math.cos(r) * 15} y2={16 + Math.sin(r) * 15}
        stroke={C} strokeWidth="1" opacity="0.5" />;
    })}
  </svg>
);

// ── 2. Classic Grandstand ─────────────────────────────────
const Grandstand: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* main building body */}
    <rect x="55" y="22" width="250" height="42" fill={CF} stroke={C} strokeWidth="1.5" />
    {/* peaked roof */}
    <path d="M50,22 L180,4 L310,22" fill={CF} stroke={C} strokeWidth="1.5" />
    {/* side wings */}
    <rect x="15" y="35" width="42" height="29" fill={CF} stroke={C} strokeWidth="1" />
    <rect x="303" y="35" width="42" height="29" fill={CF} stroke={C} strokeWidth="1" />
    {/* arched windows */}
    {[75, 111, 147, 183, 219, 255].map(x => (
      <path key={x}
        d={`M${x},42 L${x},58 L${x + 20},58 L${x + 20},42 Q${x + 10},32 ${x},42 Z`}
        fill="rgba(245,232,223,0.1)" stroke={C} strokeWidth="1" />
    ))}
    {/* flag poles + pennants */}
    {[110, 180, 250].map((x, i) => (
      <g key={x}>
        <line x1={x} y1={i === 1 ? 4 : 8} x2={x} y2={-6} stroke={C} strokeWidth="1.5" />
        <path d={`M${x},-6 L${x + 12},-2 L${x},-2 Z`} fill={C} opacity="0.7" />
      </g>
    ))}
    {/* ground / track rail */}
    <line x1="0" y1="65" x2="360" y2="65" stroke={C} strokeWidth="2" />
    <line x1="0" y1="68" x2="360" y2="68" stroke={C} strokeWidth="1" opacity="0.3" />
  </svg>
);

// ── 3. Starting Gates ─────────────────────────────────────
const StartingGates: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* ground track */}
    <line x1="0" y1="60" x2="360" y2="60" stroke={C} strokeWidth="1.5" />
    <line x1="0" y1="65" x2="360" y2="65" stroke={C} strokeWidth="1" opacity="0.35" />
    {/* top beam */}
    <line x1="28" y1="16" x2="332" y2="16" stroke={C} strokeWidth="2.5" />
    {/* gate stalls — 8 of them */}
    {Array.from({ length: 8 }).map((_, i) => {
      const x = 32 + i * 37;
      return (
        <g key={i}>
          <rect x={x} y="16" width="6" height="46" fill={CF} stroke={C} strokeWidth="1.5" />
          <rect x={x + 1} y="28" width="31" height="32" fill="rgba(245,232,223,0.05)" stroke={C} strokeWidth="1" />
          {/* number */}
          <text x={x + 17} y="23" textAnchor="middle" fontFamily="monospace"
            fontSize="7" fill={C} opacity="0.6">{i + 1}</text>
          {/* horse body suggestion */}
          <ellipse cx={x + 18} cy="52" rx="10" ry="5" fill={CS} opacity="0.22" />
        </g>
      );
    })}
    {/* START banner */}
    <rect x="140" y="4" width="80" height="14" fill={CF} stroke={C} strokeWidth="1.2" />
    <text x="180" y="15" textAnchor="middle" fontFamily="monospace"
      fontSize="8" fill={C} letterSpacing="0.18em">START</text>
  </svg>
);

// ── 4. Night Racing ───────────────────────────────────────
const NightRacing: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* stars */}
    {[[18,10],[52,6],[88,16],[128,4],[166,12],[210,7],[256,14],[298,4],[338,16]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.5" fill={CS} opacity="0.55" />
    ))}
    {/* moon crescent */}
    <path d="M316,10 Q324,6 328,14 Q320,18 316,10 Z" fill={CS} opacity="0.5" />
    {/* left floodlight tower */}
    <line x1="42" y1="68" x2="42" y2="12" stroke={C} strokeWidth="2" />
    <rect x="27" y="8" width="30" height="7" fill={CF} stroke={C} strokeWidth="1.5" rx="1" />
    <line x1="42" y1="15" x2="110" y2="60" stroke={C} strokeWidth="0.6" opacity="0.12" />
    <line x1="42" y1="15" x2="20"  y2="60" stroke={C} strokeWidth="0.6" opacity="0.12" />
    {/* right floodlight tower */}
    <line x1="318" y1="68" x2="318" y2="12" stroke={C} strokeWidth="2" />
    <rect x="303" y="8" width="30" height="7" fill={CF} stroke={C} strokeWidth="1.5" rx="1" />
    <line x1="318" y1="15" x2="250" y2="60" stroke={C} strokeWidth="0.6" opacity="0.12" />
    <line x1="318" y1="15" x2="340" y2="60" stroke={C} strokeWidth="0.6" opacity="0.12" />
    {/* oval track suggestion */}
    <ellipse cx="180" cy="52" rx="115" ry="12" fill="none" stroke={C} strokeWidth="1.5" opacity="0.4" />
    {/* galloping horse + jockey */}
    <g transform="translate(148,32)" opacity="0.8">
      <ellipse cx="20" cy="18" rx="19" ry="9" fill={CS} />
      <path d="M32,11 L38,4 L43,8 L37,14 Z" fill={CS} />
      <ellipse cx="43" cy="4" rx="6" ry="4" fill={CS} />
      <line x1="6"  y1="25" x2="0"  y2="38" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="26" x2="5"  y2="40" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="25" x2="31" y2="38" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="30" y1="24" x2="39" y2="36" stroke={CS} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M1,16 Q-8,10 -6,3" stroke={CS} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="43" cy="0" rx="8" ry="2.5" fill={C} opacity="0.8" />
    </g>
  </svg>
);

// ── 5. Coastal ────────────────────────────────────────────
const Coastal: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* distant horizon */}
    <line x1="0" y1="40" x2="360" y2="40" stroke={C} strokeWidth="1" opacity="0.25" />
    {/* wave lines */}
    <path d="M0,44 Q30,38 60,44 Q90,50 120,44 Q150,38 180,44 Q210,50 240,44 Q270,38 300,44 Q330,50 360,44"
      fill="none" stroke={C} strokeWidth="1.5" opacity="0.5" />
    <path d="M0,52 Q30,46 60,52 Q90,58 120,52 Q150,46 180,52 Q210,58 240,52 Q270,46 300,52 Q330,58 360,52"
      fill="none" stroke={C} strokeWidth="1" opacity="0.35" />
    {/* sea fill */}
    <path d="M0,44 Q30,38 60,44 Q90,50 120,44 Q150,38 180,44 Q210,50 240,44 Q270,38 300,44 Q330,50 360,44 L360,68 L0,68 Z"
      fill={CF} />
    {/* cliffs / ground */}
    <path d="M0,62 Q80,54 160,60 Q240,66 320,58 L360,60 L360,68 L0,68 Z"
      fill="rgba(245,232,223,0.07)" stroke={C} strokeWidth="1" opacity="0.5" />
    {/* lighthouse */}
    <rect x="286" y="16" width="20" height="34" fill={CF} stroke={C} strokeWidth="1.5" rx="1" />
    <path d="M282,16 L306,16 L302,8 L286,8 Z" fill={CF} stroke={C} strokeWidth="1.5" />
    <rect x="291" y="24" width="10" height="8" fill="rgba(245,232,223,0.18)" stroke={C} strokeWidth="1" />
    {/* lighthouse stripes */}
    <rect x="286" y="32" width="20" height="5" fill="rgba(245,232,223,0.12)" />
    <line x1="286" y1="50" x2="306" y2="50" stroke={C} strokeWidth="1" opacity="0.4" />
    <line x1="296" y1="50" x2="296" y2="60" stroke={C} strokeWidth="1.5" />
    {/* lighthouse beam */}
    <path d="M296,12 L266,35 L270,38 L296,12 Z" fill="rgba(245,232,223,0.04)" />
    {/* seagulls */}
    {[[70, 20], [90, 14], [110, 22]].map(([x, y], i) => (
      <path key={i} d={`M${x-5},${y} Q${x},${y-5} ${x+5},${y}`}
        fill="none" stroke={C} strokeWidth="1.2" opacity="0.5" />
    ))}
    {/* grass tufts on cliff */}
    {[30, 75, 140, 200].map(x => (
      <g key={x} opacity="0.6">
        <line x1={x - 3} y1={62} x2={x - 6} y2={55} stroke={C} strokeWidth="1" />
        <line x1={x}     y1={61} x2={x}     y2={54} stroke={C} strokeWidth="1" />
        <line x1={x + 3} y1={62} x2={x + 6} y2={55} stroke={C} strokeWidth="1" />
      </g>
    ))}
  </svg>
);

// ── 6. Virtual Circuit ────────────────────────────────────
const VirtualCircuit: React.FC = () => (
  <svg viewBox="0 0 360 68" width="100%" style={{ display: "block" }} aria-hidden>
    {/* grid */}
    {Array.from({ length: 7 }).map((_, i) => (
      <line key={`h${i}`} x1="0" y1={i * 11 + 2} x2="360" y2={i * 11 + 2}
        stroke={C} strokeWidth="0.4" opacity="0.14" />
    ))}
    {Array.from({ length: 12 }).map((_, i) => (
      <line key={`v${i}`} x1={i * 32 + 4} y1="0" x2={i * 32 + 4} y2="68"
        stroke={C} strokeWidth="0.4" opacity="0.14" />
    ))}
    {/* circuit track — dashed */}
    <path d="M38,58 L38,24 Q38,14 50,14 L160,14 Q174,14 174,24 L174,48 Q174,58 188,58 L312,58 Q326,58 326,46 L326,22 Q326,12 314,12"
      fill="none" stroke={C} strokeWidth="2" strokeDasharray="7,4" opacity="0.55" />
    {/* node circles at corners */}
    {[[38,24],[174,24],[174,48],[312,58],[326,46]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="4.5" fill="none" stroke={C} strokeWidth="1.5" opacity="0.6" />
    ))}
    {/* position dot (the active racer) */}
    <circle cx="96" cy="14" r="6" fill={CS} opacity="0.95" />
    <circle cx="96" cy="14" r="10" fill="none" stroke={CS} strokeWidth="1" opacity="0.35" />
    {/* speed lines behind dot */}
    <line x1="82" y1="14" x2="62" y2="14" stroke={C} strokeWidth="1.2" opacity="0.4" />
    <line x1="84" y1="9"  x2="67" y2="7"  stroke={C} strokeWidth="0.8" opacity="0.28" />
    <line x1="84" y1="19" x2="67" y2="21" stroke={C} strokeWidth="0.8" opacity="0.28" />
    {/* data readout suggestion */}
    <rect x="20" y="4" width="14" height="6" fill={CF} stroke={C} strokeWidth="0.8" opacity="0.5" />
    <rect x="240" y="52" width="14" height="6" fill={CF} stroke={C} strokeWidth="0.8" opacity="0.5" />
  </svg>
);

// ── Illustration catalogue ─────────────────────────────────
const SCENES = [RollingHills, Grandstand, StartingGates, NightRacing, Coastal];
// VirtualCircuit is kept separate — always used for virtual tracks

// ── Public component ──────────────────────────────────────
interface SlipIllustrationProps {
  trackName: string;
  isVirtual?: boolean;
}

export const SlipIllustration: React.FC<SlipIllustrationProps> = ({ trackName, isVirtual }) => {
  if (isVirtual) return <VirtualCircuit />;
  const idx = hashString(trackName) % SCENES.length;
  const Scene = SCENES[idx];
  return <Scene />;
};
