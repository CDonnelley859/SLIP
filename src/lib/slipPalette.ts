/**
 * slipPalette
 * ─────────────────────────────────────────────────────────
 * Six vintage racing-ticket colour palettes.
 * Each track name maps deterministically to one palette
 * via a djb2 hash — same track always gets the same colours.
 * Virtual tracks keep the default app green scheme.
 *
 * All bg/text/accent/shadow values are plain hex — never CSS
 * variable references — so they can be safely set as CSS custom
 * property overrides on the ticket wrapper without circular deps.
 */

export type SlipPalette = {
  /** Ticket background colour */
  bg: string;
  /** Main text / label colour */
  text: string;
  /** Accent colour (stamps, highlights) */
  accent: string;
  /** Box-shadow pop colour */
  shadow: string;
  /** Ticket outer border + scallop stroke */
  border: string;
  /** Subtle interior borders (pick cards, player badge) */
  subtle: string;
  /** Very faint fill (race-number badge, podium cells) */
  faint: string;
};

const PALETTES: SlipPalette[] = [
  // 1. Vintage gold — warm mustard, dark brown text
  {
    bg:     "#C49A3C",
    text:   "#1E0E06",
    accent: "#8C2020",
    shadow: "#1E0E06",
    border: "rgba(30,14,6,0.55)",
    subtle: "rgba(30,14,6,0.22)",
    faint:  "rgba(30,14,6,0.08)",
  },
  // 2. Burnt sienna — deep orange, cream text
  {
    bg:     "#A84E2E",
    text:   "#F5E8DF",
    accent: "#F0C840",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 3. Dusty teal — blue-green, cream text
  {
    bg:     "#2C6E68",
    text:   "#F5E8DF",
    accent: "#E8C84A",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 4. Vintage rose — deep maroon-pink, cream text
  {
    bg:     "#9C3858",
    text:   "#F5E8DF",
    accent: "#F0C840",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 5. Vintage navy — clearly blue (replaces olive which was too close to the app green)
  {
    bg:     "#2A4A7A",
    text:   "#F5E8DF",
    accent: "#E8C84A",
    shadow: "#F5E8DF",
    border: "rgba(245,232,223,0.5)",
    subtle: "rgba(245,232,223,0.22)",
    faint:  "rgba(245,232,223,0.08)",
  },
  // 6. Parchment — warm cream, dark brown text
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

/**
 * Default palette — actual hex values of the app's CSS variables.
 * Using real hex (not var(--…)) avoids circular custom-property refs
 * when these are set back as overrides on the ticket wrapper.
 */
export const DEFAULT_PALETTE: SlipPalette = {
  bg:     "#1f4d3a",   // --green
  text:   "#f5e8df",   // --cream
  accent: "#ec5a8c",   // --pink
  shadow: "#f5e8df",   // --cream
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
