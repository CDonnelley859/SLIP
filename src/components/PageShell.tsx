import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

export const PageShell = ({ title, children, back = "/" }: { title: string; children: ReactNode; back?: string }) => (
  <div className="min-h-screen pb-12">
    <header className="px-6 pt-8 pb-4 flex items-center gap-3">
      <Link to={back} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
      <h1 className="font-display text-2xl">{title}</h1>
    </header>
    <div className="px-6">{children}</div>
  </div>
);
