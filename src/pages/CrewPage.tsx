import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { type Crew } from "@/lib/crews";

type CrewStats = {
  gamesPlayed: number;
  totalPoints: number;
  bestScore: number;
  wins: number;
  places: number;
  shows: number;
  bestRank: number | null;
  avgPoints: number;
};

const CrewPage = () => {
  const { crewId } = useParams();
  const { userId } = useAuth();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [stats, setStats] = useState<CrewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !crewId) return;
    (async () => {
      // Load the crew doc
      const crewDoc = await getDoc(doc(db, "crews", crewId));
      if (!crewDoc.exists()) { setLoading(false); return; }
      const crewData: Crew = {
        id: crewDoc.id,
        name: crewDoc.data().name,
        createdBy: crewDoc.data().createdBy,
        members: crewDoc.data().members ?? [],
      };
      setCrew(crewData);

      // Find all scrums this user was part of that used this crew
      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("userId", "==", userId))
      );
      const scrumDocs = await Promise.all(
        membersSnap.docs.map(m => getDoc(doc(db, "scrums", m.data().scrumId)))
      );
      const crewScrums = scrumDocs.filter(
        d => d.exists() && d.data()?.crewId === crewId
      );

      if (crewScrums.length === 0) {
        setStats({ gamesPlayed: 0, totalPoints: 0, bestScore: 0, wins: 0, places: 0, shows: 0, bestRank: null, avgPoints: 0 });
        setLoading(false);
        return;
      }

      const results = await Promise.all(crewScrums.map(async (scrumDoc) => {
        const scrumId = scrumDoc.id;
        const [myPicksSnap, allPicksSnap] = await Promise.all([
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId), where("userId", "==", userId))),
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId))),
        ]);
        if (myPicksSnap.empty) return null;

        const myTotal = myPicksSnap.docs.reduce((s, p) => s + (p.data().points ?? 0), 0);
        const wins   = myPicksSnap.docs.filter(p => p.data().points === 5).length;
        const places = myPicksSnap.docs.filter(p => p.data().points === 3).length;
        const shows  = myPicksSnap.docs.filter(p => p.data().points === 1).length;

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
          wins:   valid.reduce((s, r) => s + r.wins, 0),
          places: valid.reduce((s, r) => s + r.places, 0),
          shows:  valid.reduce((s, r) => s + r.shows, 0),
          bestRank: rankedGames.length > 0 ? Math.min(...rankedGames.map(r => r.rank)) : null,
          avgPoints: Math.round(valid.reduce((s, r) => s + r.myTotal, 0) / valid.length),
        });
      }
      setLoading(false);
    })();
  }, [userId, crewId]);

  return (
    <div className="min-h-screen halftone-bg" style={{ background: "var(--green)" }}>
      <header style={{
        background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, padding: "0 18px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link to="/settings" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← SETTINGS</Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>CREW</span>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: "24px 18px 64px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {!crew && !loading ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 32, textAlign: "center" }}>
            <p className="label" style={{ color: "var(--cream)" }}>Crew not found.</p>
          </div>
        ) : (
          <>
            {/* Crew identity */}
            {crew && (
              <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: "18px 18px 16px" }}>
                <div className="display" style={{ fontSize: 32, color: "var(--cream)", lineHeight: 1, marginBottom: 12 }}>
                  {crew.name}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {crew.members.map(m => (
                    <div key={m.userId} className="label-sm" style={{ color: "var(--cream)", opacity: 0.6 }}>
                      {m.handle}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <>
                <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 24, display: "flex", justifyContent: "space-between" }}>
                  <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)" }} />
                  <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)" }} />
                </div>
                {[1, 2].map(i => (
                  <div key={i} style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 16, height: 60, background: "rgba(245,232,223,0.05)" }} />
                ))}
              </>
            ) : !stats || stats.gamesPlayed === 0 ? (
              <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 32, textAlign: "center" }}>
                <p className="label" style={{ color: "var(--cream)" }}>NO STATS YET.</p>
                <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 8 }}>
                  CREATE A GROUP USING THIS CREW TO START TRACKING.
                </p>
              </div>
            ) : (
              <>
                {/* Games + best finish */}
                <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
                  <div style={{ flex: 1, padding: "16px 18px 18px", borderRight: "1.5px solid rgba(245,232,223,0.15)" }}>
                    <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>GAMES TOGETHER</div>
                    <div className="display" style={{ fontSize: 56, lineHeight: 0.9, color: "var(--cream)" }}>{stats.gamesPlayed}</div>
                  </div>
                  <div style={{ flex: 1, padding: "16px 18px 18px", textAlign: "right" }}>
                    <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>BEST FINISH</div>
                    <div className="display" style={{ fontSize: 56, lineHeight: 0.9, color: "var(--pink)" }}>
                      {stats.bestRank ? `#${stats.bestRank}` : "—"}
                    </div>
                  </div>
                </div>

                {/* Points row */}
                <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
                  {[
                    { label: "TOTAL PTS",  value: stats.totalPoints },
                    { label: "AVG / GAME", value: stats.avgPoints },
                    { label: "BEST SCORE", value: stats.bestScore },
                  ].map((s, i) => (
                    <div key={s.label} style={{
                      flex: 1, padding: "14px 18px 16px",
                      textAlign: i === 2 ? "right" : i === 1 ? "center" : "left",
                      borderRight: i < 2 ? "1.5px solid rgba(245,232,223,0.15)" : undefined,
                    }}>
                      <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>{s.label}</div>
                      <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: "var(--cream)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Win / place / show */}
                <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
                  {[
                    { label: "WINS",   value: stats.wins,   color: "var(--pink)" },
                    { label: "PLACES", value: stats.places, color: "var(--cream)" },
                    { label: "SHOWS",  value: stats.shows,  color: "var(--cream)" },
                  ].map((s, i) => (
                    <div key={s.label} style={{
                      flex: 1, padding: "14px 18px 16px",
                      textAlign: i === 2 ? "right" : i === 1 ? "center" : "left",
                      borderRight: i < 2 ? "1.5px solid rgba(245,232,223,0.15)" : undefined,
                    }}>
                      <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>{s.label}</div>
                      <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CrewPage;
