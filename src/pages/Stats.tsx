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
    <div className="min-h-screen" style={{ background: "var(--green)" }}>
      <header
        style={{
          background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 64, padding: "0 18px", position: "sticky", top: 0, zIndex: 50,
        }}
      >
        <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← PADDOCK</Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>THE FORM</span>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: "24px 18px 64px", maxWidth: 420, margin: "0 auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{ border: "3px solid rgba(245,232,223,0.25)", borderTop: i > 1 ? "1.5px solid rgba(245,232,223,0.15)" : undefined, padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ height: 10, width: 100, background: "rgba(245,232,223,0.15)" }} />
                <div style={{ height: 28, width: 40, background: "rgba(245,232,223,0.15)" }} />
              </div>
            ))}
          </div>
        ) : !stats || stats.gamesPlayed === 0 ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 32, textAlign: "center" }}>
            <p className="label" style={{ color: "var(--cream)" }}>NO STATS YET.</p>
            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 8 }}>
              FINISH A DAILY GALLOP TO SEE YOUR FORM.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { label: "GAMES PLAYED", value: stats.gamesPlayed },
              { label: "TOTAL POINTS", value: stats.totalPoints },
              { label: "AVG POINTS / GAME", value: stats.avgPoints },
              { label: "BEST SCORE", value: stats.bestScore },
              { label: "BEST FINISH", value: stats.bestRank ? `#${stats.bestRank}` : "—" },
              { label: "WINS (1ST)", value: stats.wins },
              { label: "PLACES (2ND)", value: stats.places },
              { label: "SHOWS (3RD)", value: stats.shows },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  border: "3px solid rgba(245,232,223,0.25)",
                  borderTop: i > 0 ? "1.5px solid rgba(245,232,223,0.15)" : undefined,
                  padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>{row.label}</span>
                <span className="display" style={{ fontSize: 28, color: "var(--cream)" }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Stats;
