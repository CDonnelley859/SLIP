import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, collectionGroup } from "firebase/firestore";
import { PageShell } from "@/components/PageShell";
import { Trophy, BarChart3, Ticket } from "lucide-react";

type CompletedSlip = {
  scrumId: string;
  scrumName: string;
  trackName: string;
  date: string;
  totalPoints: number;
  rank: number | null;
  totalMembers: number;
};

const Spindle = () => {
  const { user, loading } = useAuth();
  const [slips, setSlips] = useState<CompletedSlip[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const membersSnap = await getDocs(query(
        collectionGroup(db, "members"),
        where("userId", "==", user.uid)
      ));

      const completed: CompletedSlip[] = [];
      for (const m of membersSnap.docs) {
        const scrumId = m.ref.parent.parent!.id;
        const scrumSnap = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumSnap.exists()) continue;
        const scrum = scrumSnap.data();

        const cardSnap = await getDoc(doc(db, "cards", scrum.cardId));
        const cardData = cardSnap.exists() ? cardSnap.data() : null;

        const racesSnap = await getDocs(collection(db, "cards", scrum.cardId, "races"));
        const total = racesSnap.size;
        const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
        if (settled < total || total === 0) continue; // not fully settled

        const picksSnap = await getDocs(query(
          collection(db, "scrums", scrumId, "picks"),
          where("userId", "==", user.uid)
        ));
        const totalPoints = picksSnap.docs.reduce((a, p) => a + (p.data().points ?? 0), 0);

        const allPicksSnap = await getDocs(collection(db, "scrums", scrumId, "picks"));
        const pointsByUser: Record<string, number> = {};
        allPicksSnap.docs.forEach(p => {
          const d = p.data();
          pointsByUser[d.userId] = (pointsByUser[d.userId] ?? 0) + (d.points ?? 0);
        });
        const sorted = Object.values(pointsByUser).sort((a, b) => b - a);
        const rank = sorted.indexOf(totalPoints) + 1;
        const totalMembers = sorted.length;

        completed.push({
          scrumId,
          scrumName: scrum.name,
          trackName: cardData?.trackName ?? "—",
          date: cardData?.raceDate ?? "",
          totalPoints,
          rank,
          totalMembers,
        });
      }
      setSlips(completed.sort((a, b) => b.date.localeCompare(a.date)));
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-display text-3xl brass-text font-black">The Spindle</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">Completed slips</p>
      </div>

      <div className="px-6">
        {slips.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No completed slips yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Finish a Daily Gallop to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slips.map((s) => (
              <Link key={s.scrumId} to={`/scrum/${s.scrumId}/slip`}
                className="block bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.trackName}</div>
                    <div className="font-display text-lg mt-0.5">{s.scrumName}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="brass-text font-display text-3xl font-bold">{s.totalPoints}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                    {s.rank && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.rank === 1 ? "🏆 " : ""}#{s.rank} of {s.totalMembers}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Link to="/" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><Ticket className="h-5 w-5" /> Paddock</Link>
          <Link to="/spindle" className="flex flex-col items-center gap-1 text-primary text-xs"><Trophy className="h-5 w-5" /> Spindle</Link>
          <Link to="/stats" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><BarChart3 className="h-5 w-5" /> Stats</Link>
        </div>
      </nav>
    </div>
  );
};

export default Spindle;
