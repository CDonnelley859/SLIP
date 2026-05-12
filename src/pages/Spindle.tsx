import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc, writeBatch,
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
  megaSlipId?: string;
  scrumName: string;
  trackName: string;
  date: string;
  totalPoints: number;
  rank: number | null;
  totalMembers: number;
  lines: Line[];
  leaderboard: LeaderboardEntry[];
};

type MegaTrackResult = {
  scrumId: string;
  trackName: string;
  myPoints: number;
  myRank: number | null;
  totalMembers: number;
  myWins: number;
  myPlaces: number;
  myShows: number;
};

type MegaLeaderEntry = {
  userId: string;
  handle: string;
  points: number;
  wins: number;
  places: number;
  shows: number;
  isMe: boolean;
};

type MegaGroupSlip = {
  megaSlipId: string;
  groupName: string;
  tracks: MegaTrackResult[];
  myTotalPoints: number;
  overallRank: number | null;
  totalMembers: number;
  leaderboard: MegaLeaderEntry[];
};

type CarouselItem =
  | { kind: "single"; data: CompletedSlip }
  | { kind: "mega-summary"; data: MegaGroupSlip }
  | { kind: "mega-track"; data: CompletedSlip; groupName: string };

function itemKey(item: CarouselItem): string {
  if (item.kind === "mega-summary") return `mega:${item.data.megaSlipId}`;
  return item.data.scrumId;
}

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

const ScallopTop = () => (
  <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginTop: -1 }}>
    {Array.from({ length: 25 }).map((_, i) => (
      <circle key={i} cx={8 + i * 16} cy={0} r="5" fill="var(--green)" stroke="rgba(245,232,223,0.4)" strokeWidth="1.5" />
    ))}
  </svg>
);

const ScallopBottom = () => (
  <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginBottom: -1, transform: "scaleY(-1)" }}>
    {Array.from({ length: 25 }).map((_, i) => (
      <circle key={i} cx={8 + i * 16} cy={0} r="5" fill="var(--green)" stroke="rgba(245,232,223,0.4)" strokeWidth="1.5" />
    ))}
  </svg>
);

const TicketNotches = () => (
  <>
    <div style={{ position: "absolute", left: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", transform: "translateY(-50%)" }} />
    <div style={{ position: "absolute", right: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", transform: "translateY(-50%)" }} />
  </>
);

const Spindle = () => {
  const { userId } = useAuth();
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function onCarouselScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setVisibleIdx(idx);
  }

  function toggleFlip(key: string) {
    setFlipped(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleDelete(scrumId: string) {
    if (!userId) return;
    setDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "scrumMembers", `${scrumId}_${userId}`));
      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("scrumId", "==", scrumId), where("userId", "==", userId))
      );
      picksSnap.docs.forEach(p => batch.delete(p.ref));
      await batch.commit();
      setItems(prev => prev.filter(item =>
        !(item.kind === "single" && item.data.scrumId === scrumId)
      ));
      setConfirmDelete(null);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
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
          scrumId,
          megaSlipId: scrum.megaSlipId ?? undefined,
          scrumName: scrum.name,
          trackName: cardData?.trackName ?? "—",
          date: cardData?.raceDate ?? "",
          totalPoints, rank, totalMembers: leaderboard.length,
          lines, leaderboard,
        } as CompletedSlip;
      }));

      // ── Separate singles vs mega-owned ─────────────────────────────────────
      const singleSlips: CompletedSlip[] = [];
      const megaGroups = new Map<string, CompletedSlip[]>();

      for (const r of results) {
        if (!r) continue;
        if (r.megaSlipId) {
          if (!megaGroups.has(r.megaSlipId)) megaGroups.set(r.megaSlipId, []);
          megaGroups.get(r.megaSlipId)!.push(r);
        } else {
          singleSlips.push(r);
        }
      }

      singleSlips.sort((a, b) => b.date.localeCompare(a.date));

      // ── Build mega summaries ────────────────────────────────────────────────
      const megaItems: CarouselItem[] = [];

      for (const [megaSlipId, tracks] of megaGroups) {
        const megaDoc = await getDoc(doc(db, "megaSlips", megaSlipId));
        const groupName = megaDoc.exists() ? (megaDoc.data().name ?? "MEGA GROUP") : "MEGA GROUP";

        // Per-track results (my stats on each track)
        const trackResults: MegaTrackResult[] = tracks.map(t => {
          const myEntry = t.leaderboard.find(e => e.isMe);
          return {
            scrumId: t.scrumId,
            trackName: t.trackName,
            myPoints: t.totalPoints,
            myRank: t.rank,
            totalMembers: t.totalMembers,
            myWins: myEntry?.wins ?? 0,
            myPlaces: myEntry?.places ?? 0,
            myShows: myEntry?.shows ?? 0,
          };
        });
        trackResults.sort((a, b) => a.trackName.localeCompare(b.trackName));

        // Combined leaderboard across all tracks
        const combined: Record<string, { handle: string; points: number; wins: number; places: number; shows: number }> = {};
        for (const track of tracks) {
          for (const entry of track.leaderboard) {
            if (!combined[entry.userId]) {
              combined[entry.userId] = { handle: entry.handle, points: 0, wins: 0, places: 0, shows: 0 };
            }
            combined[entry.userId].points += entry.points;
            combined[entry.userId].wins += entry.wins;
            combined[entry.userId].places += entry.places;
            combined[entry.userId].shows += entry.shows;
          }
        }

        const leaderboard: MegaLeaderEntry[] = Object.entries(combined)
          .map(([uid, s]) => ({ userId: uid, handle: s.handle, isMe: uid === userId, ...s }))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.places !== a.places) return b.places - a.places;
            return b.shows - a.shows;
          });

        const myLeaderEntry = leaderboard.find(e => e.isMe);
        const overallRank = myLeaderEntry ? leaderboard.indexOf(myLeaderEntry) + 1 : null;
        const myTotalPoints = trackResults.reduce((a, t) => a + t.myPoints, 0);

        const summary: MegaGroupSlip = {
          megaSlipId, groupName, tracks: trackResults,
          myTotalPoints, overallRank,
          totalMembers: leaderboard.length,
          leaderboard,
        };

        // Sort individual track slips by date (newest first)
        tracks.sort((a, b) => b.date.localeCompare(a.date));

        // Mega summary card first, then individual track slips
        megaItems.push({ kind: "mega-summary", data: summary });
        tracks.forEach(t => megaItems.push({ kind: "mega-track", data: t, groupName }));
      }

      // ── Final order: singles → mega groups ─────────────────────────────────
      const allItems: CarouselItem[] = [
        ...singleSlips.map(s => ({ kind: "single" as const, data: s })),
        ...megaItems,
      ];

      setItems(allItems);
      setLoading(false);
    })();
  }, [userId]);

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.18em",
    textTransform: "uppercase", opacity: 0.65, color: "var(--cream)",
  };

  const currentItem = items[visibleIdx];
  const currentKey = currentItem ? itemKey(currentItem) : "";
  const isCurrentFlipped = flipped.has(currentKey);

  // ── Render a single/mega-track slip ticket ──────────────────────────────────
  function renderSlipCard(s: CompletedSlip, isFlipped: boolean, badge?: string) {
    const dateStr = s.date
      ? new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
      : "";
    return (
      <div style={{ position: "relative", zIndex: 1, background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", boxShadow: "6px 6px 0 var(--cream)" }}>
        <ScallopTop />

        {/* STUB */}
        <div style={{ padding: "14px 20px 18px", borderBottom: "2px dashed rgba(245,232,223,0.35)", position: "relative" }}>
          <TicketNotches />
          {badge && (
            <div className="label" style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.2em", color: "var(--pink)", marginBottom: 4 }}>
              {badge}
            </div>
          )}
          <div className="display" style={{ fontSize: 40, lineHeight: 0.9, textAlign: "center", marginBottom: 4, color: "var(--cream)" }}>
            {s.trackName}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <div className="perf" style={{ width: 30 }} />
            <span className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--cream)", opacity: 0.6 }}>
              {s.scrumName}{dateStr ? ` · ${dateStr}` : ""}
            </span>
            <div className="perf" style={{ width: 30 }} />
          </div>
          <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div className="label-sm" style={labelStyle}>TOTAL</div>
              <div className="display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--pink)", textShadow: "2px 2px 0 rgba(245,232,223,0.4)" }}>
                {s.totalPoints}
                <span className="label" style={{ fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--cream)", textShadow: "none" }}>PTS</span>
              </div>
            </div>
            {s.rank && (
              <div style={{ textAlign: "right" }}>
                <div className="label-sm" style={labelStyle}>RANK</div>
                <div className="display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--pink)", textShadow: "2px 2px 0 rgba(245,232,223,0.4)" }}>
                  #{s.rank}
                  <span className="label" style={{ fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--cream)", textShadow: "none" }}>OF {s.totalMembers}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        {isFlipped ? (
          /* STANDINGS */
          <div style={{ padding: "14px 18px 20px" }} className="animate-fade-in">
            <div className="label" style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.3em", marginBottom: 12, opacity: 0.65, color: "var(--cream)" }}>
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
                    <span className="display" style={{ fontSize: 16, opacity: 0.45, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>#{i + 1}</span>
                    <div>
                      <div className="display" style={{ fontSize: 20, lineHeight: 0.9, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                        {entry.handle}
                        {entry.isMe && <span className="label-sm" style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>(YOU)</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 3, opacity: 0.6, display: "flex", gap: 6, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                        {entry.wins > 0 && <span>{entry.wins}W</span>}
                        {entry.places > 0 && <span>{entry.places}P</span>}
                        {entry.shows > 0 && <span>{entry.shows}S</span>}
                      </div>
                    </div>
                  </div>
                  <div className="display" style={{ fontSize: 32, lineHeight: 0.85, color: i === 0 ? "var(--pink)" : entry.isMe ? "var(--ink)" : "var(--cream)" }}>
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
                        <span className="mono" style={{
                          background: "rgba(245,232,223,0.2)", color: "var(--cream)",
                          fontSize: 9, letterSpacing: "0.18em", padding: "2px 6px",
                          border: "1px solid rgba(245,232,223,0.3)",
                        }}>
                          RACE {String(l.raceNumber).padStart(2, "0")}
                        </span>
                        {offTimeStr && (
                          <span className="mono" style={{ fontSize: 10, opacity: 0.6, color: "var(--cream)" }}>
                            {offTimeStr}
                          </span>
                        )}
                        <span className="mono" style={{ fontSize: 10, opacity: 0.7, marginLeft: "auto", color: "var(--cream)" }}>
                          +{l.points} PTS
                        </span>
                      </div>
                      <div
                        className="display"
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
                          <div className="mono" style={{ fontSize: 10, marginTop: 2, color: "var(--cream)" }}>
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

        <ScallopBottom />
      </div>
    );
  }

  // ── Render mega summary card ────────────────────────────────────────────────
  function renderMegaSummaryCard(mega: MegaGroupSlip, isFlipped: boolean) {
    return (
      <div style={{ position: "relative", zIndex: 1, background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", boxShadow: "6px 6px 0 var(--cream)" }}>
        <ScallopTop />

        {/* STUB */}
        <div style={{ padding: "14px 20px 18px", borderBottom: "2px dashed rgba(245,232,223,0.35)", position: "relative" }}>
          <TicketNotches />
          <div className="label" style={{ textAlign: "center", fontSize: 9, letterSpacing: "0.25em", color: "var(--pink)", marginBottom: 4 }}>
            MEGA GROUP
          </div>
          <div className="display" style={{ fontSize: 34, lineHeight: 0.95, textAlign: "center", marginBottom: 10, color: "var(--cream)" }}>
            {mega.groupName}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--cream)", opacity: 0.5 }}>
              {mega.tracks.length} TRACK{mega.tracks.length !== 1 ? "S" : ""}
            </span>
          </div>
          <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div className="label-sm" style={labelStyle}>COMBINED TOTAL</div>
              <div className="display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--pink)", textShadow: "2px 2px 0 rgba(245,232,223,0.4)" }}>
                {mega.myTotalPoints}
                <span className="label" style={{ fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--cream)", textShadow: "none" }}>PTS</span>
              </div>
            </div>
            {mega.overallRank && (
              <div style={{ textAlign: "right" }}>
                <div className="label-sm" style={labelStyle}>OVERALL RANK</div>
                <div className="display" style={{ fontSize: 50, lineHeight: 0.85, color: "var(--pink)", textShadow: "2px 2px 0 rgba(245,232,223,0.4)" }}>
                  #{mega.overallRank}
                  <span className="label" style={{ fontSize: 14, marginLeft: 6, opacity: 0.6, color: "var(--cream)", textShadow: "none" }}>OF {mega.totalMembers}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        {isFlipped ? (
          /* STANDINGS — combined mega leaderboard */
          <div style={{ padding: "14px 18px 20px" }} className="animate-fade-in">
            <div className="label" style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.3em", marginBottom: 12, opacity: 0.65, color: "var(--cream)" }}>
              FINAL STANDINGS · MEGA GROUP
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {mega.leaderboard.map((entry, i) => (
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
                    <span className="display" style={{ fontSize: 16, opacity: 0.45, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>#{i + 1}</span>
                    <div>
                      <div className="display" style={{ fontSize: 20, lineHeight: 0.9, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                        {entry.handle}
                        {entry.isMe && <span className="label-sm" style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>(YOU)</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 3, opacity: 0.6, display: "flex", gap: 6, color: entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                        {entry.wins > 0 && <span>{entry.wins}W</span>}
                        {entry.places > 0 && <span>{entry.places}P</span>}
                        {entry.shows > 0 && <span>{entry.shows}S</span>}
                      </div>
                    </div>
                  </div>
                  <div className="display" style={{ fontSize: 32, lineHeight: 0.85, color: i === 0 ? "var(--pink)" : entry.isMe ? "var(--ink)" : "var(--cream)" }}>
                    {entry.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* TRACK LIST — picks side */
          <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 8 }} className="animate-fade-in">
            {mega.tracks.map((t) => (
              <div
                key={t.scrumId}
                style={{
                  border: "1.5px solid rgba(245,232,223,0.25)",
                  background: "var(--green)",
                  padding: "10px 12px",
                }}
              >
                {/* Track name + rank */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div className="display" style={{ fontSize: 16, color: "var(--cream)", lineHeight: 1 }}>
                    {t.trackName}
                  </div>
                  {t.myRank && (
                    <div className="mono" style={{ fontSize: 10, color: "var(--cream)", opacity: 0.6, flexShrink: 0, paddingLeft: 8 }}>
                      #{t.myRank} OF {t.totalMembers}
                    </div>
                  )}
                </div>
                {/* W·P·S + pts */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--cream)", opacity: 0.65, display: "flex", gap: 8 }}>
                    {t.myWins > 0 && <span>{t.myWins}W</span>}
                    {t.myPlaces > 0 && <span>{t.myPlaces}P</span>}
                    {t.myShows > 0 && <span>{t.myShows}S</span>}
                    {t.myWins === 0 && t.myPlaces === 0 && t.myShows === 0 && (
                      <span style={{ opacity: 0.35 }}>NO PLACES</span>
                    )}
                  </div>
                  <div className="display" style={{ fontSize: 24, lineHeight: 0.85, color: "var(--pink)" }}>
                    {t.myPoints}
                    <span className="label" style={{ fontSize: 11, marginLeft: 4, opacity: 0.6, color: "var(--cream)" }}>PTS</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ScallopBottom />
      </div>
    );
  }

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
        <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>
          ← PADDOCK
        </Link>
        <span className="display" style={{ fontSize: 24, color: "var(--cream)" }}>THE SPINDLE</span>
        <div style={{ minWidth: 70, textAlign: "right" }}>
          {items.length > 0 && currentItem && (
            <button
              onClick={() => toggleFlip(currentKey)}
              className="label"
              style={{
                background: "transparent", border: 0, cursor: "pointer",
                color: "var(--cream)", textDecoration: "underline",
              }}
            >
              {isCurrentFlipped ? "PICKS" : "STANDINGS"}
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
        ) : items.length === 0 ? (
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
              {items.map((item) => {
                const key = itemKey(item);
                const isFlipped = flipped.has(key);

                return (
                  <div
                    key={key}
                    className="flex-shrink-0 snap-center"
                    style={{ width: "100vw", display: "flex", justifyContent: "center", padding: "0 18px" }}
                  >
                    <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
                      {item.kind === "mega-summary"
                        ? renderMegaSummaryCard(item.data, isFlipped)
                        : item.kind === "mega-track"
                          ? renderSlipCard(item.data, isFlipped, `PART OF ${item.groupName}`)
                          : renderSlipCard(item.data, isFlipped)
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {/* dot indicators */}
            {items.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
                {items.map((item, i) => (
                  <div
                    key={itemKey(item)}
                    style={{
                      width: item.kind === "mega-summary" ? 12 : 8,
                      height: 8, borderRadius: item.kind === "mega-summary" ? 4 : "50%",
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

      {/* fixed REMOVE — only for single slips, only on standings side */}
      {(() => {
        if (!currentItem || currentItem.kind !== "single") return null;
        if (!isCurrentFlipped) return null;
        const scrumId = currentItem.data.scrumId;
        return (
          <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 40 }}>
            {confirmDelete === scrumId ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>REMOVE THIS SLIP?</span>
                <button
                  onClick={() => handleDelete(scrumId)}
                  disabled={deleting}
                  className="label-sm"
                  style={{
                    background: "transparent", border: "1px solid rgba(245,232,223,0.45)",
                    color: "var(--cream)", padding: "3px 8px", cursor: "pointer",
                    opacity: deleting ? 0.4 : 0.85,
                  }}
                >
                  {deleting ? "…" : "YES"}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="label-sm"
                  style={{
                    background: "transparent", border: 0,
                    color: "var(--cream)", padding: "3px 0", cursor: "pointer", opacity: 0.45,
                  }}
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(scrumId)}
                className="label-sm"
                style={{
                  background: "transparent", border: 0,
                  color: "var(--cream)", cursor: "pointer",
                  opacity: 0.25, padding: 0,
                  textDecoration: "underline",
                }}
              >
                REMOVE
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default Spindle;
