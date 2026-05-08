import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
} from "firebase/firestore";

type StatSummary = {
  gamesPlayed: number;
  totalPoints: number;
  bestScore: number;
  wins: number;
  places: number;
  shows: number;
  bestRank: number | null;
  avgPoints: number;
};

const Stats = () => {
  const { userId } = useAuth();
  const [stats, setStats] = useState<StatSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("userId", "==", userId))
      );

      const results = await Promise.all(membersSnap.docs.map(async (m) => {
        const scrumId = m.data().scrumId;
        const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumDoc.exists()) return null;
        const scrum = scrumDoc.data();

        const [myPicksSnap, allPicksSnap] = await Promise.all([
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId), where("userId", "==", userId))),
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId))),
        ]);

        if (myPicksSnap.empty) return null;

        const myTotal = myPicksSnap.docs.reduce((sum, p) => sum + (p.data().points ?? 0), 0);
        const wins = myPicksSnap.docs.filter(p => p.data().points === 5).length;
        const places = myPicksSnap.docs.filter(p => p.data().points === 3).length;
        const shows = myPicksSnap.docs.filter(p => p.data().points === 1).length;

        const pointsByUser: Record<string, number> = {};
        allPicksSnap.docs.forEach(p => {
          const uid = p.data().userId;
          pointsByUser[uid] = (pointsByUser[uid] ?? 0) + (p.data().points ?? 0);
        });
        const sorted = Object.values(pointsByUser).sort((a, b) => b - a);
        const rank = sorted.indexOf(myTotal) + 1;

        return { myTotal, wins, places, shows, rank, members: sorted.length };
      }));

      const valid = results.filter(Boolean) as NonNullable<typeof results[0]>[];

      if (valid.length === 0) {
        setStats({ gamesPlayed: 0, totalPoints: 0, bestScore: 0, wins: 0, places: 0, shows: 0, bestRank: null, avgPoints: 0 });
      } else {
        const rankedGames = valid.filter(r => r.members > 1);
        setStats({
          gamesPlayed: valid.length,
          totalPoints: valid.reduce((s, r) => s + r.myTotal, 0),
          bestScore: Math.max(...valid.map(r => r.myTotal)),
          wins: valid.reduce((s, r) => s + r.wins, 0),
          places: valid.reduce((s, r) => s + r.places, 0),
          shows: valid.reduce((s, r) => s + r.shows, 0),
          bestRank: rankedGames.length > 0 ? Math.min(...rankedGames.map(r => r.rank)) : null,
          avgPoints: Math.round(valid.reduce((s, r) => s + r.myTotal, 0) / valid.length),
        });
      }

      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b-brutalist flex items-center justify-between h-16 px-4 sticky top-0 z-50">
        <Link to="/" className="text-label-caps uppercase hover:underline">← PADDOCK</Link>
        <h1 className="text-headline-md uppercase">THE FORM</h1>
        <div className="w-20" />
      </header>

      <main className="px-4 pt-6 pb-16 max-w-sm mx-auto">
        {loading ? (
          <div className="space-y-[-2.67px] animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="border-brutalist px-4 py-4 flex justify-between items-center mt-[-2.67px] first:mt-0">
                <div className="h-3 w-24 bg-primary/10 rounded" />
                <div className="h-7 w-10 bg-primary/10 rounded" />
              </div>
            ))}
          </div>
        ) : !stats || stats.gamesPlayed === 0 ? (
          <div className="border-brutalist p-8 text-center">
            <p className="text-body-md text-muted-foreground">No stats yet.</p>
            <p className="text-label-caps text-muted-foreground uppercase mt-2">
              Finish a Daily Gallop to see your form.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {[
              { label: "Games Played", value: stats.gamesPlayed },
              { label: "Total Points", value: stats.totalPoints },
              { label: "Avg Points / Game", value: stats.avgPoints },
              { label: "Best Score", value: stats.bestScore },
              { label: "Best Finish", value: stats.bestRank ? `#${stats.bestRank}` : "—" },
              { label: "Wins (1st)", value: stats.wins },
              { label: "Places (2nd)", value: stats.places },
              { label: "Shows (3rd)", value: stats.shows },
            ].map((row, i) => (
              <div
                key={i}
                className={`border-brutalist px-4 py-4 flex justify-between items-center ${i > 0 ? "mt-[-2.67px]" : ""}`}
              >
                <span className="text-label-caps uppercase text-muted-foreground">{row.label}</span>
                <span className="text-headline-md font-black">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Stats;
