import type { ReactNode } from "react";

/** Full-height green page shell with a constrained, padded content column. */
export const Page = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen" style={{ background: "var(--green)" }}>
    {children}
  </div>
);

export const PageBody = ({ children, maxWidth = 420, centered = false, bottomPad = 24, gap }: {
  children: ReactNode; maxWidth?: number; centered?: boolean; bottomPad?: number; gap?: number;
}) => (
  <main
    style={{
      padding: `24px 18px ${bottomPad}px`,
      maxWidth,
      margin: centered ? "0 auto" : undefined,
      ...(gap !== undefined ? { display: "flex", flexDirection: "column", gap } : {}),
    }}
  >
    {children}
  </main>
);
