import type { ReactNode } from "react";

/** Outlined container used for stats rows, empty states and errors. */
export const Panel = ({ children, padding, flex, center }: {
  children: ReactNode; padding?: number | string; flex?: boolean; center?: boolean;
}) => (
  <div
    style={{
      border: "3px solid rgba(245,232,223,0.25)",
      ...(padding !== undefined ? { padding } : {}),
      ...(flex ? { display: "flex" } : {}),
      ...(center ? { textAlign: "center" as const } : {}),
    }}
  >
    {children}
  </div>
);

/** Message panel for empty / error states (a slot where a mascot can go later). */
export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <Panel padding={32} center>
    <p className="label" style={{ color: "var(--cream)" }}>{title}</p>
    {hint && <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 8 }}>{hint}</p>}
    {action}
  </Panel>
);

/** One cell in a row of stats inside a flex Panel. */
export const StatCell = ({ label, value, color = "var(--cream)", size = 40, align = "left", divider = true }: {
  label: string; value: ReactNode; color?: string; size?: number;
  align?: "left" | "center" | "right"; divider?: boolean;
}) => (
  <div
    style={{
      flex: 1, padding: size > 40 ? "16px 18px 18px" : "14px 18px 16px", textAlign: align,
      borderRight: divider ? "1.5px solid rgba(245,232,223,0.15)" : undefined,
    }}
  >
    <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>{label}</div>
    <div className="display" style={{ fontSize: size, lineHeight: 0.9, color }}>{value}</div>
  </div>
);
