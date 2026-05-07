import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface PageShellProps {
  title: string;
  children: ReactNode;
  back?: string;
}

export const PageShell = ({ title, children, back = "/" }: PageShellProps) => (
  <div className="min-h-screen bg-background pb-20">
    <header className="bg-background border-b-brutalist flex items-center h-16 px-4 sticky top-0 z-50">
      <Link to={back} className="text-label-caps uppercase mr-4 hover:underline">
        ← BACK
      </Link>
      <h1 className="text-body-lg uppercase">{title}</h1>
    </header>
    <main className="px-4 pt-4">{children}</main>
  </div>
);
