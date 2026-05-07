import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, BarChart3, Plus, LogOut, Ticket } from "lucide-react";
import { format } from "date-fns";

type Card = { id: string; track_name: string; race_date: string; post_time: string; status: string };
type ActiveSlip = {
  scrum_id: string;
  scrum_name: string;
  track_name: string;
  completed: number;
  total: number;
  score: number;
};

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState<ActiveSlip[]>([]);
  const [handle, setHandle] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
      if (profile) setHandle(profile.handle);

      const { data: cardData } = await supabase
        .from("cards")
        .select("*")
        .in("status", ["upcoming", "live"])
        .order("post_time", { ascending: true })
        .limit(8);
      setCards(cardData ?? []);

      const { data: scrums } = await supabase
        .from("scrums")
        .select("id, name, cards(track_name, status), races:cards!inner(races(id, status))");
      // Simplified: fetch scrums + tally separately
      const { data: myScrums } = await supabase
        .from("scrum_members")
        .select("scrum_id, scrums(id, name, card_id, cards(track_name))")
        .eq("user_id", user.id);

      if (myScrums) {
        const slips: ActiveSlip[] = [];
        for (const m of myScrums as any[]) {
          const s = m.scrums;
          if (!s) continue;
          const { data: races } = await supabase.from("races").select("id, status").eq("card_id", s.card_id);
          const { data: pts } = await supabase
            .from("picks")
            .select("points")
            .eq("scrum_id", s.id)
            .eq("user_id", user.id);
          const completed = (races ?? []).filter((r: any) => r.status === "settled").length;
          const total = (races ?? []).length;
          if (total === 0 || completed < total) {
            slips.push({
              scrum_id: s.id,
              scrum_name: s.name,
              track_name: s.cards?.track_name ?? "—",
              completed,
              total,
              score: (pts ?? []).reduce((a: number, p: any) => a + (p.points ?? 0), 0),
            });
          }
        }
        setActive(slips);
      }
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-6 pt-8 pb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl brass-text font-black leading-none">SLIP</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">The Paddock</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">@{handle}</span>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Active Slips */}
      <section className="px-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Active Slips</h2>
          <Ticket className="h-4 w-4 text-muted-foreground" />
        </div>
        {active.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No active slips. Start a Scrum below.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto -mx-6 px-6 snap-x">
            {active.map((s) => (
              <Link
                key={s.scrum_id}
                to={`/scrum/${s.scrum_id}/slip`}
                className="snap-start min-w-[260px] bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition"
              >
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.track_name}</div>
                <div className="font-display text-lg mt-1">{s.scrum_name}</div>
                <div className="flex items-baseline justify-between mt-3">
                  <div>
                    <span className="brass-text font-display text-3xl font-bold">{s.score}</span>
                    <span className="text-muted-foreground text-xs ml-1">pts</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {s.completed}/{s.total || 6} races
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Big Board */}
      <section className="px-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">The Big Board</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const { toast } = await import("sonner");
                toast.loading("Pulling cards…", { id: "sync" });
                const { data, error } = await supabase.functions.invoke("sync-cards", { body: {} });
                if (error || !data?.ok) toast.error(error?.message ?? data?.error ?? "Failed", { id: "sync" });
                else { toast.success(`${data.cards} cards loaded`, { id: "sync" }); location.reload(); }
              }}
              className="text-xs text-primary hover:underline"
            >Refresh</button>
            <Link to="/scrum/join" className="text-xs text-primary hover:underline">Join code</Link>
          </div>
        </div>
        {cards.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No cards loaded yet.</p>
            <p className="text-xs text-muted-foreground">Tap Refresh to pull today's racecards.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <Link
                key={c.id}
                to={`/scrum/new?card=${c.id}`}
                className="block bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg">{c.track_name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {format(new Date(c.post_time), "EEE MMM d · h:mm a")}
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Link to="/" className="flex flex-col items-center gap-1 text-primary text-xs">
            <Ticket className="h-5 w-5" /> Paddock
          </Link>
          <Link to="/spindle" className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
            <Trophy className="h-5 w-5" /> Spindle
          </Link>
          <Link to="/stats" className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
            <BarChart3 className="h-5 w-5" /> Stats
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Index;
