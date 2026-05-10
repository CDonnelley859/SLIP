import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
} from "firebase/firestore";

type LineStatus = "WIN" | "PLACE" | "SHOW" | "OUT";
type Line = {
  raceNumber: number;
  horseName: string;
  horseNumber: number;
  offTime: string | null;
  status: LineStatus;
  points: number;
  podium: {
    first: { number: number; name: string } | null;
    second: { number: number; name: string } | null;
    third: { number: number; name: string } | null;
  };
};

type LeaderboardEntry = {
  userId: string;
  handle: string;
  points: number;
  wins: number;
  places: number;
  shows: number;
  isMe: boolean;
};

type CompletedSlip = {
  scrumId: string;
  scrumName: string;
  trackName: string;
  date: string;
  totalPoints: number;
  rank: number | null;
  totalMembers: number;
  lines: Line[];
  leaderboard: LeaderboardEntry[];
};

function statusFor(winners: any, horseId: string): LineStatus {
  if (!winners) return "OUT";
  if (winners.first === horseId) return "WIN";
  if (winners.second === horseId) return "PLACE";
  if (winners.third === horseId) return "SHOW";
  return "OUT";
}

function pointsFor(status: LineStatus): number {
  if (status === "WIN") return 5;
  if (status === "PLACE") return 3;
  if (status === "SHOW") return 1;
  return 0;
}

const StampBadge = ({ status }: { status: LineStatus }) => {
  if (status === "WIN") return <span className="stamp-win">WIN</span>;
  if (status === "PLACE") return <span className="stamp-place">PLACE</span>;
  if (status === "SHOW") return <span className="stamp-show">SHOW</span>;
  return <span className="stamp-out">OUT</span>;
};

const Spindle = () => {
  const { userId } = useAuth();
  const [slips, setSlips] = useState<CompletedSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [visibleIdx, setVisibleIdx] = useState(0);

  function onCarouselScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setVisibleIdx(idx);
  }

  function toggleFlip(scrumId: string) {
    setFlipped(prev => {
      const next = new Set(prev);
      next.has(scrumId) ? next.delete(scrumId) : next.add(scrumId);
      return next;
    });
  }

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("userId", "==", userId))
      );

      const results = await Promise.all(membersSnap.docs.map(async (m) => {
        const scrumId = m.data().scrumId;
        const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumDoc.exists()) return null;
        const scrum = scrumDoc.data();

        const [cardDocReal, myPicksSnap, allPicksSnap, allMembersSnap] = await Promise.all([
          getDoc(doc(db, "cards", scrum.cardId)),
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId), where("userId", "==", userId))),
          getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId))),
          getDocs(query(collection(db, "scrumMembers"), where("scrumId", "==", scrumId))),
        ]);

        const cardData = cardDocReal?.data();
        const isPreviousDay = cardData?.raceDate && cardData.raceDate < today;
        if (!isPreviousDay) {
          const racesSnap = await getDocs(
            query(collection(db, "races"), where("cardId", "==", scrum.cardId))
          );
          const total = racesSnap.size;
          const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
          if (total === 0 || settled < total) return null;
        }

        const pickData = myPicksSnap.docs.map(p => p.data());
        const [raceDocs, horseDocs] = await Promise.all([
          Promise.all(pickData.map(p => getDoc(doc(db, "races", p.raceId)))),
          Promise.all(pickData.map(p => getDoc(doc(db, "horses", p.horseId)))),
        ]);

        const winnerIdSet = new Set<string>();
        raceDocs.forEach(rd => {
          const w = rd.data()?.winners;
          if (w?.first) winnerIdSet.add(w.first);
          if (w?.second) winnerIdSet.add(w.second);
          if (w?.third) winnerIdSet.add(w.third);
        });
        const winnerIdArr = [...winnerIdSet];
        const winnerDocs = await Promise.all(winnerIdArr.map(id => getDoc(doc(db, "horses", id))));
        const winnerMap: Record<string, { number: number; name: string }> = {};
        winnerDocs.forEach((d, i) => {
          if (d.exists()) winnerMap[winnerIdArr[i]] = { number: d.data().number, name: d.data().name };
        });

        const lines: Line[] = pickData.map((pick, i) => {
          const race = raceDocs[i].data();
          const horse = horseDocs[i].data();
          const winners = race?.winners;
          const status = statusFor(winners, pick.horseId);
          return {
            raceNumber: race?.raceNumber ?? 0,
            horseName: horse?.name ?? "—",
            horseNumber: horse?.number ?? 0,
            offTime: race?.offTime ?? null,
            status,
            points: pointsFor(status),
            podium: {
              first: winners?.first ? (winnerMap[winners.first] ?? null) : null,
              second: winners?.second ? (winnerMap[winners.second] ?? null) : null,
              third: winners?.third ? (winnerMap[winners.third] ?? null) : null,
            },
          };
        });

        lines.sort((a, b) => a.raceNumber - b.raceNumber);
        const totalPoints = lines.reduce((a, l) => a + l.points, 0);

        const handleMap: Record<string, string> = {};
        allMembersSnap.docs.forEach(d => { handleMap[d.data().userId] = d.data().handle ?? "Anonymous"; });

        const statsByUser: Record<string, { points: number; wins: number; places: number; shows: number }> = {};
        allPicksSnap.docs.forEach(p => {
          const uid = p.data().userId;
          const pts = p.data().points ?? 0;
          if (!statsByUser[uid]) statsByUser[uid] = { points: 0, wins: 0, places: 0, shows: 0 };
          statsByUser[uid].points += pts;
          if (pts === 5) statsByUser[uid].wins++;
          else if (pts === 3) statsByUser[uid].places++;
          else if (pts === 1) statsByUser[uid].shows++;
        });

        const leaderboard: LeaderboardEntry[] = Object.entries(statsByUser)
          .map(([uid, s]) => ({ userId: uid, handle: handleMap[uid] ?? "—", ...s, isMe: uid === userId }))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.places !== a.places) return b.places - a.places;
            return b.shows - a.shows;
          });

        const myEntry = leaderboard.find(e => e.isMe);
        const rank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;

        return {
          scrumId, scrumName: scrum.name,
          trackName: cardData?.trackName ?? "—",
          date: cardData?.raceDate ?? "",
          totalPoints, rank, totalMembers: leaderboard.length,
          lines, leaderboard,
        } as CompletedSlip;
      }));

      const valid = results.filter((r): r is CompletedSlip => r !== null);
      setSlips(valid.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    })();
  }, [userId]);

  const label: React.CSSProperties = {
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    fontWeight: 700, fontSize: 9, letterSpacing: "0.18em",
    textTransform: "uppercase", opacity: 0.65, color: "var(--ink)",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--green)" }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
          padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--cream)", textDecoration: "none" }}
        >
          ← PADDOCK
        </Link>
        <span className="font-display" style={{ fontSize: 24, color: "var(--cream)" }}>THE SPINDLE</span>
        <div style={{ minWidth: 70, textAlign: "right" }}>
          {slips.length > 0 && (
            <button
              onClick={() => toggleFlip(slips[visibleIdx]?.scrumId)}
              style={{
                background: "transparent", border: 0, cursor: "pointer",
                fontWeight: 700, fontSize: 11, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "var(--cream)",
                textDecoration: "underline",
              }}
            >
              {flipped.has(slips[visibleIdx]?.scrumId) ? "PICKS" : "STANDINGS"}
            </button>
          )}
        </div>
      </header>

      <main style={{ paddingTop: 24, paddingBottom: 40 }}>
        {loading ? (
          <div style={{ padding: "0 18px" }}>
            <div className="retro-ticket animate-pulse" style={{ maxWidth: 420, margin: "0 auto", padding: "24px 20px" }}>
              <div style={{ height: 24, width: 160, background: "var(--cream-2)", margin: "0 auto 10px" }} />
              <div style={{ height: 14, width: 120, background: "var(--cream-2)", margin: "0 auto 20px" }} />
              <div style={{ height: 40, width: 80, background: "var(--cream-2)", marginBottom: 16 }} />
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 60, background: "var(--cream-2)", marginBottom: 8 }} />
              ))}
            </div>
          </div>
        ) : slips.length === 0 ? (
          <div
            style={{
              margin: "0 18px", border: "3px solid rgba(245,232,223,0.25)",
              padding: "32px", textAlign: "center", background: "var(--green)",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--cream)" }}>
              No completed slips yet.
            </p>
            <p style={{ fontWeight: 700, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 8, opacity: 0.5, color: "var(--cream)" }}>
              Finish a Daily Gallop to see it here.
            </p>
          </div>
        ) : (
          <>
            <div
              className="flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", paddingBottom: 16 }}
              onScroll={onCarouselScroll}
            >
              {slips.map((s) => {
                const isFlipped = flipped.has(s.scrumId);
                const dateStr = s.date
                  ? new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
                  : "";

                return (
                  <div
                    key={s.scrumId}
                    className="flex-shrink-0 snap-center"
                    style={{ width: "100vw", display: "flex", justifyContent: "center", padding: "0 18px" }}
                  >
                    {/* ticket wrapper */}
                    <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
                      {/* drop shadow */}
                      <div style={{ position: "absolute", inset: "8px -6px -8px 6px", background: "var(--ink)", zIndex: 0 }} />

                      <div style={{ position: "relative", zIndex: 1, background: "var(--cream)", border: "3px solid var(--ink)" }}>

                        {/* scalloped top */}
                        <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginTop: -1 }}>
                          {Array.from({ length: 25 }).map((_, i2) => (
                            <circle key={i2} cx={8 + i2 * 16} cy={0} r="5" fill="var(--cream-2)" stroke="var(--ink)" strokeWidth="1.5" />
                          ))}
                        </svg>

                        {/* STUB */}
                        <div style={{ padding: "14px 20px 18px", borderBottom: "2px dashed var(--ink)", position: "relative" }}>
                          <div style={{ position: "absolute", left: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--cream-2)", border: "3px solid var(--ink)", transform: "translateY(-50%)" }} />
                          <div style={{ position: "absolute", right: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--cream-2)", border: "3px solid var(--ink)", transform: "translateY(-50%)" }} />

                          <div className="font-display" style={{ fontSize: 40, lineHeight: 0.9, textAlign: "center", marginBottom: 4 }}>
                            {s.trackName}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                            <div className="perf" style={{ width: 30 }} />
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                              {s.scrumName}{dateStr ? ` · ${dateStr}` : ""}
                            </span>
                            <div className="perf" style={{ width: 30 }} />
                          </div>
                          <div style={{ borderTop: "1px solid rgba(26,20,16,0.15)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <div>
                              <div style={label}>TOTAL</div>
                              <div className="font-display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--pink)", textShadow: "2px 2px 0 var(--ink)" }}>
                                {s.totalPoints}
                                <span style={{ fontFamily: "Space Grotesk", fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--ink)", textShadow: "none" }}>PTS</span>
                              </div>
                            </div>
                            {s.rank && (
                              <div style={{ textAlign: "right" }}>
                                <div style={label}>RANK</div>
                                <div className="font-display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--green)", textShadow: "2px 2px 0 var(--ink)" }}>
                                  #{s.rank}
                                  <span style={{ fontFamily: "Space Grotesk", fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--ink)", textShadow: "none" }}>OF {s.totalMembers}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* BODY — toggled by flip */}
                        {isFlipped ? (
                          /* STANDINGS */
                          <div style={{ padding: "14px 18px 20px" }} className="animate-fade-in">
                            <div className="font-display" style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.3em", marginBottom: 12, opacity: 0.65, textTransform: "uppercase", color: "var(--ink)" }}>
                              FINAL STANDINGS
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {s.leaderboard.map((entry, i) => (
                                <div
                                  key={entry.userId}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 8px",
                                    background: entry.isMe ? "var(--pink)" : "var(--green)",
                                    border: entry.isMe ? "2px dashed var(--ink)" : "1px solid rgba(245,232,223,0.2)",
                                    marginBottom: 4,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span className="font-display" style={{ fontSize: 16, opacity: 0.45, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>#{i + 1}</span>
                                    <div>
                                      <div className="font-display" style={{ fontSize: 20, lineHeight: 0.9, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                                        {entry.handle}
                                        {entry.isMe && <span style={{ fontFamily: "Space Grotesk", fontSize: 11, opacity: 0.5, marginLeft: 6 }}>(YOU)</span>}
                                      </div>
                                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, marginTop: 3, opacity: 0.6, display: "flex", gap: 6, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                                        {entry.wins > 0 && <span>{entry.wins}W</span>}
                                        {entry.places > 0 && <span>{entry.places}P</span>}
                                        {entry.shows > 0 && <span>{entry.shows}S</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="font-display" style={{ fontSize: 32, lineHeight: 0.85, color: i === 0 ? "var(--pink)" : entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                                    {entry.points}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* PICKS */
                          <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }} className="animate-fade-in">
                            {s.lines.map((l, i) => {
                              const isOut = l.status === "OUT";
                              const offTimeStr = l.offTime
                                ? new Date(l.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : null;
                              return (
                                <div
                                  key={i}
                                  style={{
                                    border: "1.5px solid rgba(245,232,223,0.25)",
                                    background: "var(--green)",
                                    padding: "10px 12px",
                                    opacity: isOut ? 0.5 : 1,
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                        <span style={{
                                          background: "var(--ink)", color: "var(--cream)",
                                          fontFamily: "JetBrains Mono, monospace",
                                          fontSize: 9, letterSpacing: "0.18em", padding: "2px 6px",
                                        }}>
                                          RACE {String(l.raceNumber).padStart(2, "0")}
                                        </span>
                                        {offTimeStr && (
                                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, opacity: 0.6, color: "var(--cream)" }}>
                                            {offTimeStr}
                                          </span>
                                        )}
                                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, opacity: 0.7, marginLeft: "auto", color: "var(--cream)" }}>
                                          +{l.points} PTS
                                        </span>
                                      </div>
                                      <div
                                        className="font-display"
                                        style={{ fontSize: 16, lineHeight: 1, color: "var(--cream)", textDecoration: isOut ? "line-through" : "none" }}
                                      >
                                        {l.horseNumber}. {l.horseName}
                                      </div>
                                    </div>
                                    <div style={{ flexShrink: 0, paddingTop: 2, paddingLeft: 8 }}>
                                      <StampBadge status={l.status} />
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                    {(["first", "second", "third"] as const).map((pos, pi) => {
                                      const horse = l.podium[pos];
                                      return (
                                        <div
                                          key={pos}
                                          style={{
                                            flex: 1, border: "1.5px solid rgba(245,232,223,0.25)", padding: "5px 6px",
                                            textAlign: "center", background: "rgba(245,232,223,0.08)", opacity: 0.8,
                                          }}
                                        >
                                          <div style={{ fontWeight: 700, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--cream)" }}>
                                            {["1ST", "2ND", "3RD"][pi]}
                                          </div>
                                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, marginTop: 2, color: "var(--cream)" }}>
                                            {horse ? `${horse.number}. ${horse.name.slice(0, 12)}` : "—"}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* scalloped bottom */}
                        <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginBottom: -1, transform: "scaleY(-1)" }}>
                          {Array.from({ length: 25 }).map((_, i2) => (
                            <circle key={i2} cx={8 + i2 * 16} cy={0} r="5" fill="var(--cream-2)" stroke="var(--ink)" strokeWidth="1.5" />
                          ))}
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* dot indicators */}
            {slips.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                {slips.map((s, i) => (
                  <div
                    key={s.scrumId}
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      border: "2px solid var(--cream)",
                      background: i === visibleIdx ? "var(--cream)" : "transparent",
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Spindle;
