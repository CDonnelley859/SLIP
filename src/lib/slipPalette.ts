/**
 * slipPalette
 * ─────────────────────────────────────────────────────────
 * Six vintage racing-ticket colour palettes.
 * Each track name maps deterministically to one palette
 * via a djb2 hash — same track always gets the same colours.
 * Virtual tracks keep the default app green scheme.
 */

export type SlipPalette = {
  /** Ticket background colour (overrides --green on the wrapper) */
  bg: string;
  /** Main text colour (overrides --cream) */
  text: string;
  /** Accent / stamp colour (overrides --pink) */
  accent: string;
  /** Box-shadow pop colour */
  shadow: string;
  /** Ticket outer border + scallop edge stroke */
  border: string;
  /** Subtle interior borders (pick cards, player badge, perforations) */
  subtle: string;
  /** Very faint fill (race-number badge, podium cells) */
  faint: string;
};

const PALETTES: SlipPalette[] = [
  // 1. Vintage gold
  {
    bg:     "#C49A3C",
    text:   "#1E0E06",
    accent: "#8C2020",
    shadow: "#1E0E06",
    border: "rgba(30,14,6,0.55)",
    subtle: "rgba(30,14,6,0.22)",
    faint:  "rgba(30,14,6,0.08)",
  },
  // 2. Burnt sienna
  {
    bg:     "#A84E2E",
    text:   "#F5E8DF",
    accent: "#F0C840",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 3. Dusty teal
  {
    bg:     "#2C6E68",
    text:   "#F5E8DF",
    accent: "#E8C84A",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 4. Vintage rose
  {
    bg:     "#9C3858",
    text:   "#F5E8DF",
    accent: "#F0C840",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 5. Olive
  {
    bg:     "#4A6020",
    text:   "#F5E8DF",
    accent: "#E8C84A",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 6. Parchment
  {
    bg:     "#D6C090",
    text:   "#1E0E06",
    accent: "#8C2020",
    shadow: "#1E0E06",
    border: "rgba(30,14,6,0.5)",
    subtle: "rgba(30,14,6,0.2)",
    faint:  "rgba(30,14,6,0.07)",
  },
];

/** Default palette — keeps the existing app green/cream theme */
export const DEFAULT_PALETTE: SlipPalette = {
  bg:     "var(--green)",
  text:   "var(--cream)",
  accent: "var(--pink)",
  shadow: "var(--cream)",
  border: "rgba(245,232,223,0.4)",
  subtle: "rgba(245,232,223,0.25)",
  faint:  "rgba(245,232,223,0.08)",
};

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getSlipPalette(trackName?: string, isVirtual?: boolean): SlipPalette {
  if (!trackName || isVirtual) return DEFAULT_PALETTE;
  return PALETTES[hashString(trackName) % PALETTES.length];
}
