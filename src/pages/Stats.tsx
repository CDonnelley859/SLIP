import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { computeUserStats, type StatSummary } from "@/lib/stats";

const Stats = () => {
  const { userId } = useAuth();
  const [stats, setStats] = useState<StatSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    computeUserStats(userId)
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
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
        <Link to="/settings" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← SETTINGS</Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>THE FORM</span>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: "24px 18px 64px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <>
            <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 24, display: "flex", justifyContent: "space-between" }}>
              <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)" }} />
              <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)" }} />
            </div>
            {[1,2,3].map(i => (
              <div key={i} style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 16, height: 60, background: "rgba(245,232,223,0.05)" }} />
            ))}
          </>
        ) : error ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 32, textAlign: "center" }}>
            <p className="label" style={{ color: "var(--cream)" }}>COULDN'T LOAD YOUR FORM.</p>
            <button onClick={() => window.location.reload()} className="label-sm" style={{ marginTop: 12, background: "transparent", border: "1.5px solid rgba(245,232,223,0.4)", color: "var(--cream)", padding: "8px 14px", cursor: "pointer" }}>
              RETRY
            </button>
          </div>
        ) : !stats || stats.gamesPlayed === 0 ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 32, textAlign: "center" }}>
            <p className="label" style={{ color: "var(--cream)" }}>NO STATS YET.</p>
            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 8 }}>
              FINISH A DAILY GALLOP TO SEE YOUR FORM.
            </p>
          </div>
        ) : (
          <>
            {/* hero row — games + best finish */}
            <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
              <div style={{ flex: 1, padding: "16px 18px 18px", borderRight: "1.5px solid rgba(245,232,223,0.15)" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>GAMES PLAYED</div>
                <div className="display" style={{ fontSize: 56, lineHeight: 0.9, color: "var(--cream)" }}>{stats.gamesPlayed}</div>
              </div>
              <div style={{ flex: 1, padding: "16px 18px 18px", textAlign: "right" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>BEST FINISH</div>
                <div className="display" style={{ fontSize: 56, lineHeight: 0.9, color: "var(--pink)" }}>
                  {stats.bestRank ? `#${stats.bestRank}` : "—"}
                </div>
              </div>
            </div>

            {/* points row */}
            <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
              <div style={{ flex: 1, padding: "14px 18px 16px", borderRight: "1.5px solid rgba(245,232,223,0.15)" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>TOTAL PTS</div>
                <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: "var(--cream)" }}>{stats.totalPoints}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 18px 16px", borderRight: "1.5px solid rgba(245,232,223,0.15)" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>AVG / GAME</div>
                <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: "var(--cream)" }}>{stats.avgPoints}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 18px 16px", textAlign: "right" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>BEST SCORE</div>
                <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: "var(--cream)" }}>{stats.bestScore}</div>
              </div>
            </div>

            {/* win / place / show */}
            <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex" }}>
              {[
                { label: "WINS", value: stats.wins, color: "var(--pink)" },
                { label: "PLACES", value: stats.places, color: "var(--cream)" },
                { label: "SHOWS", value: stats.shows, color: "var(--cream)" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1, padding: "14px 18px 16px", textAlign: i === 2 ? "right" : i === 1 ? "center" : "left",
                    borderRight: i < 2 ? "1.5px solid rgba(245,232,223,0.15)" : undefined,
                  }}
                >
                  <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 4 }}>{s.label}</div>
                  <div className="display" style={{ fontSize: 40, lineHeight: 0.9, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Stats;
