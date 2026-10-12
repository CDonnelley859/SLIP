import type { ReactNode } from "react";

/** Full-width cream submit bar; greys out when disabled. */
export const SubmitButton = ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => (
  <button
    type="submit"
    disabled={disabled}
    className="display"
    style={{
      width: "100%", padding: "16px", fontSize: 18, letterSpacing: "0.06em",
      textTransform: "uppercase", border: 0, cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? "rgba(245,232,223,0.25)" : "var(--cream)",
      color: disabled ? "rgba(245,232,223,0.4)" : "var(--ink)",
    }}
  >
    {children}
  </button>
);
