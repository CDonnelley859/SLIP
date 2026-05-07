import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, collectionGroup } from "firebase/firestore";
import { Trophy, BarChart3, Ticket } from "lucide-react";

type Stats = {
  totalSlips: number;
  totalPoints: number;
  bestScore: number;
  podiums: number; // top 3 finishes
  wins: number;   // 1st place finishes
};

const Stats = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalSlips: 0, totalPoints: 0, bestScore: 0, podiums: 0, wins: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const membersSnap = await getDocs(query(
        collectionGroup(db, "members"),
        where("userId", "==", user.uid)
      ));

      let totalSlips = 0, totalPoints = 0, bestScore = 0, podiums = 0, wins = 0;

      for (const m of membersSnap.docs) {
        const scrumId = m.ref.parent.parent!.id;
        const scrumSnap = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumSnap.exists()) continue;
        const scrum = scrumSnap.data();

        const racesSnap = await getDocs(collection(db, "cards", scrum.cardId, "races"));
        const total = racesSnap.size;
        const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
        if (settled < total || total === 0) continue;

        const picksSnap = await getDocs(query(
          collection(db, "scrums", scrumId, "picks"),
          where("userId", "==", user.uid)
        ));
        const score = picksSnap.docs.reduce((a, p) => a + (p.data().points ?? 0), 0);

        const allPicksSnap = await getDocs(collection(db, "scrums", scrumId, "picks"));
        const pointsByUser: Record<string, number> = {};
        allPicksSnap.docs.forEach(p => {
          const d = p.data();
          pointsByUser[d.userId] = (pointsByUser[d.userId] ?? 0) + (d.points ?? 0);
        });
        const sorted = Object.values(pointsByUser).sort((a, b) => b - a);
        const rank = sorted.indexOf(score) + 1;

        totalSlips++;
        totalPoints += score;
        if (score > bestScore) bestScore = score;
        if (rank <= 3) podiums++;
        if (rank === 1) wins++;
      }

      setStats({ totalSlips, totalPoints, bestScore, podiums, wins });
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const tiles = [
    { label: "Slips Filed", value: stats.totalSlips },
    { label: "Total Points", value: stats.totalPoints },
    { label: "Best Score", value: stats.bestScore },
    { label: "Podiums", value: stats.podiums },
    { label: "Wins", value: stats.wins },
    { label: "Win Rate", value: stats.totalSlips > 0 ? `${Math.round((stats.wins / stats.totalSlips) * 100)}%` : "—" },
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-display text-3xl brass-text font-black">Stats</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">Your record</p>
      </div>

      <div className="px-6">
        {stats.totalSlips === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No completed slips yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="bg-card rounded-lg p-4 border border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
                <div className="font-display text-3xl brass-text mt-1">{t.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Link to="/" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><Ticket className="h-5 w-5" /> Paddock</Link>
          <Link to="/spindle" className="flex flex-col items-center gap-1 text-muted-foreground text-xs"><Trophy className="h-5 w-5" /> Spindle</Link>
          <Link to="/stats" className="flex flex-col items-center gap-1 text-primary text-xs"><BarChart3 className="h-5 w-5" /> Stats</Link>
        </div>
      </nav>
    </div>
  );
};

export default Stats;
