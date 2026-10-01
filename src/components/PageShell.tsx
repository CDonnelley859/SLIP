import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface PageShellProps {
  title: string;
  children: ReactNode;
  back?: string;
}

export const PageShell = ({ title, children, back = "/" }: PageShellProps) => (
  <div className="min-h-screen pb-20" style={{ background: "var(--green)" }}>
    <header
      className="border-b-brutalist flex items-center gap-4 h-16 px-4 sticky top-0 z-50"
      style={{ background: "var(--cream)", boxShadow: "0 4px 0 var(--green-deep)" }}
    >
      <Link to={back} className="label hover:underline">
        ← BACK
      </Link>
      <span className="perf-v" style={{ height: 24, background: "none", backgroundImage: "linear-gradient(to bottom, var(--ink) 50%, transparent 50%)", opacity: 0.4 }} />
      <h1 className="display" style={{ fontSize: 20, color: "var(--ink)" }}>{title}</h1>
    </header>
    <main className="px-4 pt-4">{children}</main>
  </div>
);
