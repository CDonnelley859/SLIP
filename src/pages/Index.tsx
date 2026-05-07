import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, collectionGroup } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Trophy, BarChart3, Plus, LogOut, Ticket } from "lucide-react";
import { format } from "date-fns";
import { syncCards } from "@/lib/racingApi";
import { toast } from "sonner";

type Card = { id: string; trackName: string; raceDate: string; postTime: string; status: string };
type ActiveSlip = { scrumId: string; scrumName: string; trackName: string; completed: number; total: number; score: number };

const Index = () => {
  const { user, loading, handle, signOut } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState<ActiveSlip[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const cardsSnap = await getDocs(query(
      collection(db, "cards"),
      where("status", "in", ["upcoming", "live"]),
      orderBy("postTime", "asc"),
      limit(8)
    ));
    setCards(cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Card)));

    const membersSnap = await getDocs(query(
      collectionGroup(db, "members"),
      where("userId", "==", user!.uid)
    ));

    const slips: ActiveSlip[] = [];
    for (const m of membersSnap.docs) {
      const scrumId = m.ref.parent.parent!.id;
      const scrumSnap = await getDoc(doc(db, "scrums", scrumId));
      if (!scrumSnap.exists()) continue;
      const scrum = scrumSnap.data();
      const cardSnap = await getDoc(doc(db, "cards", scrum.cardId));
      const trackName = cardSnap.exists() ? cardSnap.data().trackName : "—";
      const racesSnap = await getDocs(collection(db, "cards", scrum.cardId, "races"));
      const total = racesSnap.size;
      const completed = racesSnap.docs.filter(r => r.data().status === "settled").length;
      if (total > 0 && completed >= total) continue;
      const picksSnap = await getDocs(query(collection(db, "scrums", scrumId, "picks"), where("userId", "==", user!.uid)));
      const score = picksSnap.docs.reduce((a, p) => a + (p.data().points ?? 0), 0);
      slips.push({ scrumId, scrumName: scrum.name, trackName, completed, total, score });
    }
    setActive(slips);
  }

  async function handleRefresh() {
    toast.loading("Pulling cards…", { id: "sync" });
    try {
      const count = await syncCards();
      toast.success(`${count} cards loaded`, { id: "sync" });
      loadData();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to sync", { id: "sync" });
    }
  }

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen pb-24">
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
              <Link key={s.scrumId} to={`/scrum/${s.scrumId}/slip`}
                className="snap-start min-w-[260px] bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.trackName}</div>
                <div className="font-display text-lg mt-1">{s.scrumName}</div>
                <div className="flex items-baseline justify-between mt-3">
                  <div>
                    <span className="brass-text font-display text-3xl font-bold">{s.score}</span>
                    <span className="text-muted-foreground text-xs ml-1">pts</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{s.completed}/{s.total || 6} races</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="px-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">The Big Board</h2>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="text-xs text-primary hover:underline">Refresh</button>
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
              <Link key={c.id} to={`/scrum/new?card=${c.id}`}
                className="block bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg">{c.trackName}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {format(new Date(c.postTime), "EEE MMM d · h:mm a")}
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Link to="/" className="flex flex-col items-center gap-1 text-primary text-xs"><Ticket className="h-5 w-5" /> Paddock</Link>
          <Link to="/spindle" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><Trophy className="h-5 w-5" /> Spindle</Link>
          <Link to="/stats" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><BarChart3 className="h-5 w-5" /> Stats</Link>
        </div>
      </nav>
    </div>
  );
};

export default Index;
