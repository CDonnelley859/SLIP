import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { Page, PageBody, PageHeader, Panel, EmptyState, StatCell } from "@/components/slip";
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
    <Page>
      <PageHeader title="THE FORM" titleSize={22} backTo="/settings" backLabel="SETTINGS" right={null} />
      <PageBody maxWidth={420} centered bottomPad={64} gap={12}>
        {loading ? (
          <>
            <Panel padding={24} flex>
              <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)" }} />
              <div style={{ height: 60, width: 80, background: "rgba(245,232,223,0.1)", marginLeft: "auto" }} />
            </Panel>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 16, height: 60, background: "rgba(245,232,223,0.05)" }} />
            ))}
          </>
        ) : error ? (
          <EmptyState
            title="COULDN'T LOAD YOUR FORM."
            action={
              <button onClick={() => window.location.reload()} className="label-sm" style={{ marginTop: 12, background: "transparent", border: "1.5px solid rgba(245,232,223,0.4)", color: "var(--cream)", padding: "8px 14px", cursor: "pointer" }}>
                RETRY
              </button>
            }
          />
        ) : !stats || stats.gamesPlayed === 0 ? (
          <EmptyState title="NO STATS YET." hint="FINISH A DAILY GALLOP TO SEE YOUR FORM." />
        ) : (
          <>
            <Panel flex>
              <StatCell label="GAMES PLAYED" value={stats.gamesPlayed} size={56} />
              <StatCell label="BEST FINISH" value={stats.bestRank ? `#${stats.bestRank}` : "—"} size={56} color="var(--pink)" align="right" divider={false} />
            </Panel>
            <Panel flex>
              <StatCell label="TOTAL PTS" value={stats.totalPoints} />
              <StatCell label="AVG / GAME" value={stats.avgPoints} />
              <StatCell label="BEST SCORE" value={stats.bestScore} align="right" divider={false} />
            </Panel>
            <Panel flex>
              <StatCell label="WINS" value={stats.wins} color="var(--pink)" />
              <StatCell label="PLACES" value={stats.places} align="center" />
              <StatCell label="SHOWS" value={stats.shows} align="right" divider={false} />
            </Panel>
          </>
        )}
      </PageBody>
    </Page>
  );
};

export default Stats;
