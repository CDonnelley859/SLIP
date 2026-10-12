import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

type Props = {
  title: string;
  /** Route for the back link. Omit to use the "/" default with a button. */
  backTo?: string;
  backLabel?: string;
  /** Right-hand slot; when set, the title is centred between back and slot. */
  right?: ReactNode;
  titleSize?: number;
};

const barStyle = {
  background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
  display: "flex", alignItems: "center", height: 64, padding: "0 18px",
  position: "sticky" as const, top: 0, zIndex: 50,
};

/** Sticky top bar: ← back, title, optional right slot. */
export const PageHeader = ({ title, backTo = "/", backLabel = "BACK", right, titleSize = 20 }: Props) => {
  const navigate = useNavigate();
  const back = backTo === "/" && backLabel === "BACK" ? (
    <button
      onClick={() => navigate("/")}
      className="label"
      style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", marginRight: 16 }}
    >
      ← BACK
    </button>
  ) : (
    <Link to={backTo} className="label" style={{ color: "var(--cream)", textDecoration: "none", marginRight: 16 }}>
      ← {backLabel}
    </Link>
  );

  return (
    <header style={{ ...barStyle, justifyContent: right ? "space-between" : undefined }}>
      {back}
      <span className="display" style={{ fontSize: titleSize, color: "var(--cream)" }}>{title}</span>
      {right !== undefined && <div style={{ width: 80, textAlign: "right" }}>{right}</div>}
    </header>
  );
};
