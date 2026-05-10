import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncResults } from "@/lib/racingApi";
import { registerPush, unregisterPush, isPushRegistered } from "@/lib/notifications";
import {
  doc, getDoc, getDocs, collection, query, where, onSnapshot,
} from "firebase/firestore";
import { toast } from "sonner";

type LineStatus = "WIN" | "PLACE" | "SHOW" | "OUT" | "RUNNING" | "PENDING";
type Line = {
  raceNumber: number; horseName: string; horseNumber: number;
  offTime: string | null;
  status: LineStatus; points: number;
  podium: {
    first: { number: number; name: string } | null;
    second: { number: number; name: string } | null;
    third: { number: number; name: string } | null;
  };
};

function getStatus(raceStatus: string, horseId: string, winners: any): LineStatus {
  if (raceStatus === "upcoming") return "PENDING";
  if (raceStatus === "live") return "RUNNING";
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
  if (status === "RUNNING") return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 10, height: 10, background: "var(--retro-pink)", animation: "pulse 1s infinite" }} />
      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        RUNNING
      </span>
    </div>
  );
  if (status === "PENDING") return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.1em", opacity: 0.35, textTransform: "uppercase" }}>
      PENDING
    </span>
  );
  if (status === "WIN") return <span className="stamp-win">WIN</span>;
  if (status === "PLACE") return <span className="stamp-place">PLACE</span>;
  if (status === "SHOW") return <span className="stamp-show">SHOW</span>;
  return <span className="stamp-out">OUT</span>;
};

const Slip = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [players, setPlayers] = useState<{ userId: string; handle: string }[]>([]);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [rank, setRank] = useState<{ position: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [slideKey, setSlideKey] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const currentPlayer = players[playerIdx];
  const viewUserId = currentPlayer?.userId ?? userId;
  const isOwnSlip = viewUserId === userId;

  async function buildLines(forUserId: string) {
    if (!id) return;
    const [picksSnap, allPicksSnap] = await Promise.all([
      getDocs(query(collection(db, "picks"), where("scrumId", "==", id), where("userId", "==", forUserId))),
      getDocs(query(collection(db, "picks"), where("scrumId", "==", id))),
    ]);

    const pickData = picksSnap.docs.map(p => p.data());
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
    const winnerDocs = await Promise.all(winnerIdArr.map(wid => getDoc(doc(db, "horses", wid))));
    const winnerMap: Record<string, { number: number; name: string }> = {};
    winnerDocs.forEach((d, i) => {
      if (d.exists()) winnerMap[winnerIdArr[i]] = { number: d.data().number, name: d.data().name };
    });

    const built: Line[] = pickData.map((pick, i) => {
      const race = raceDocs[i].data();
      const horse = horseDocs[i].data();
      const winners = race?.winners;
      const status = getStatus(race?.status ?? "upcoming", pick.horseId, winners);
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

    const sorted = built.sort((a, b) => a.raceNumber - b.raceNumber);
    setLines(sorted);

    const myTotal = sorted.reduce((sum, l) => sum + l.points, 0);
    const myWins = sorted.filter(l => l.status === "WIN").length;
    const myPlaces = sorted.filter(l => l.status === "PLACE").length;
    const myShows = sorted.filter(l => l.status === "SHOW").length;

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
    const allStats = Object.values(statsByUser).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.places !== a.places) return b.places - a.places;
      return b.shows - a.shows;
    });
    const position = allStats.findIndex(
      s => s.points === myTotal && s.wins === myWins && s.places === myPlaces && s.shows === myShows
    ) + 1;
    if (position > 0 && allStats.length > 1) {
      setRank({ position, total: allStats.length });
    } else {
      setRank(null);
    }
  }

  useEffect(() => {
    isPushRegistered().then(setNotifEnabled).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const scrumDoc = await getDoc(doc(db, "scrums", id));
      if (!scrumDoc.exists()) return;
      const scrumData = scrumDoc.data();
      setScrum(scrumData);
      const cardDoc = await getDoc(doc(db, "cards", scrumData.cardId));
      setCard(cardDoc.data());

      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("scrumId", "==", id))
      );
      const allMembers = membersSnap.docs.map(d => ({
        userId: d.data().userId,
        handle: d.data().handle ?? "Anonymous",
      }));
      const sorted = [
        ...allMembers.filter(m => m.userId === userId),
        ...allMembers.filter(m => m.userId !== userId),
      ];
      setPlayers(sorted);

      try { await syncResults(scrumData.cardId); } catch { }
      await buildLines(sorted[0]?.userId ?? userId ?? "");
    })();

    const unsub = onSnapshot(
      query(collection(db, "picks"), where("scrumId", "==", id)),
      () => { if (viewUserId) buildLines(viewUserId); }
    );
    const interval = setInterval(() => {
      if (viewUserId) buildLines(viewUserId);
    }, 30000);
    return () => { unsub(); clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    if (viewUserId) buildLines(viewUserId);
  }, [playerIdx]);

  function goToPlayer(dir: "forward" | "back") {
    setSlideDir(dir);
    setSlideKey(k => k + 1);
    setPlayerIdx(i =>
      dir === "forward" ? Math.min(players.length - 1, i + 1) : Math.max(0, i - 1)
    );
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && playerIdx < players.length - 1) goToPlayer("forward");
    if (dx > 0 && playerIdx > 0) goToPlayer("back");
  }

  const total = lines.reduce((sum, l) => sum + l.points, 0);
  const isFullyPending = lines.length > 0 && lines.every(l => l.status === "PENDING");

  const raceDate = card?.raceDate
    ? new Date(card.raceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "";
  const postTime = card?.postTime
    ? new Date(card.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const label: React.CSSProperties = {
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    fontWeight: 700, fontSize: 9, letterSpacing: "0.18em",
    textTransform: "uppercase", opacity: 0.65, color: "var(--ink)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: "var(--cream-2)", padding: "0 0 80px" }}
    >
      {/* ── PAGE HEADER ── */}
      <div
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
        }}
      >
        <Link
          to={`/scrum/${id}/lobby`}
          style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", textDecoration: "none" }}
        >
          ← PADDOCK
        </Link>
        <span className="font-display" style={{ fontSize: 22, color: "var(--ink)" }}>THE SLIP</span>
        <Link
          to="/spindle"
          style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", textDecoration: "underline" }}
        >
          SPINDLE
        </Link>
      </div>

      {/* ── PLAYER DOTS ── */}
      {players.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {players.map((p, i) => (
            <button
              key={p.userId}
              onClick={() => {
                setSlideDir(i > playerIdx ? "forward" : "back");
                setSlideKey(k => k + 1);
                setPlayerIdx(i);
              }}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                border: "2px solid var(--ink)",
                background: i === playerIdx ? "var(--ink)" : "transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}

      {/* ── TICKET ── */}
      <div
        key={slideKey}
        className={`retro-ticket ${slideKey === 0 ? "animate-print" : slideDir === "forward" ? "animate-slide-forward" : "animate-slide-back"}`}
        style={{
          width: "calc(100% - 36px)", maxWidth: 420,
          position: "relative",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* drop shadow board */}
        <div style={{ position: "absolute", inset: "8px -6px -8px 6px", background: "var(--ink)", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, background: "var(--cream)", border: "3px solid var(--ink)" }}>

          {/* scalloped top edge */}
          <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginTop: -1 }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <circle key={i} cx={8 + i * 16} cy={0} r="5" fill="var(--cream-2)" stroke="var(--ink)" strokeWidth="1.5" />
            ))}
          </svg>

          {/* STUB — venue, group, date, total, rank */}
          <div style={{ padding: "14px 20px 18px", borderBottom: "2px dashed var(--ink)", position: "relative" }}>
            {/* perforation notch circles */}
            <div style={{ position: "absolute", left: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--cream-2)", border: "3px solid var(--ink)", transform: "translateY(-50%)" }} />
            <div style={{ position: "absolute", right: -12, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "var(--cream-2)", border: "3px solid var(--ink)", transform: "translateY(-50%)" }} />

            {/* player badge */}
            {currentPlayer && (
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <span
                  style={{
                    border: "2px solid var(--ink)", padding: "3px 10px",
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                  }}
                >
                  {isOwnSlip ? "YOUR SLIP" : `${currentPlayer.handle}'S SLIP`}
                </span>
              </div>
            )}

            <div className="font-display" style={{ fontSize: 40, lineHeight: 0.9, textAlign: "center", marginBottom: 4 }}>
              {card?.trackName ?? "—"}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
              <div className="perf" style={{ width: 30 }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {raceDate}{postTime ? ` · POST ${postTime}` : ""}
              </span>
              <div className="perf" style={{ width: 30 }} />
            </div>

            {scrum?.name && (
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span style={{ ...label, opacity: 0.5 }}>{scrum.name}</span>
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(26,20,16,0.15)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={label}>TOTAL</div>
                <div className="font-display" style={{ fontSize: 48, lineHeight: 0.85, color: isFullyPending ? "var(--ink)" : "var(--retro-pink)", textShadow: isFullyPending ? "none" : "2px 2px 0 var(--ink)" }}>
                  {isFullyPending ? "—" : total}
                  <span style={{ fontFamily: "Space Grotesk", fontSize: 13, marginLeft: 6, opacity: 0.6, color: "var(--ink)", textShadow: "none" }}>PTS</span>
                </div>
              </div>
              {rank && (
                <div style={{ textAlign: "right" }}>
                  <div style={label}>RANK</div>
                  <div className="font-display" style={{ fontSize: 48, lineHeight: 0.85, color: "var(--retro-green)", textShadow: "2px 2px 0 var(--ink)" }}>
                    #{rank.position}
                    <span style={{ fontFamily: "Space Grotesk", fontSize: 13, marginLeft: 6, opacity: 0.6, color: "var(--ink)", textShadow: "none" }}>OF {rank.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BODY — race lines */}
          <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.length === 0 && (
              <p style={{ ...label, textAlign: "center", paddingBlock: 16 }}>
                No picks yet — head to the Daily Gallop
              </p>
            )}
            {lines.map((l, i) => {
              const isOut = l.status === "OUT";
              const offTimeStr = l.offTime
                ? new Date(l.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : null;
              return (
                <div
                  key={i}
                  style={{
                    border: "2px solid var(--ink)",
                    background: "var(--cream)",
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
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, opacity: 0.6 }}>
                            {offTimeStr}
                          </span>
                        )}
                      </div>
                      <div
                        className="font-display"
                        style={{ fontSize: 16, lineHeight: 1, textDecoration: isOut ? "line-through" : "none" }}
                      >
                        {l.horseNumber}. {l.horseName}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, paddingTop: 2, paddingLeft: 8 }}>
                      <StampBadge status={l.status} />
                    </div>
                  </div>

                  {/* podium boxes */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {(["first", "second", "third"] as const).map((pos, pi) => {
                      const horse = l.podium[pos];
                      return (
                        <div
                          key={pos}
                          style={{
                            flex: 1, border: "1.5px solid var(--ink)", padding: "5px 6px",
                            textAlign: "center", background: "var(--cream-2)", opacity: 0.8,
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                            {["1ST", "2ND", "3RD"][pi]}
                          </div>
                          <div className="font-display" style={{ fontSize: 12, marginTop: 2 }}>
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

          {/* scalloped bottom edge */}
          <svg viewBox="0 0 400 10" preserveAspectRatio="none" style={{ width: "100%", height: 10, display: "block", marginBottom: -1, transform: "scaleY(-1)" }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <circle key={i} cx={8 + i * 16} cy={0} r="5" fill="var(--cream-2)" stroke="var(--ink)" strokeWidth="1.5" />
            ))}
          </svg>
        </div>
      </div>

      {/* swipe hint */}
      {players.length > 1 && (
        <p style={{ fontWeight: 700, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 12, opacity: 0.4, color: "var(--ink)" }}>
          ← SWIPE TO SEE OTHER SLIPS →
        </p>
      )}

      {/* action buttons */}
      <div style={{ width: "calc(100% - 36px)", maxWidth: 420, marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {isOwnSlip && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-retro"
            style={{ opacity: refreshing ? 0.4 : 1 }}
          >
            {refreshing ? "REFRESHING…" : "↻ REFRESH RESULTS"}
          </button>
        )}

        {isOwnSlip && "Notification" in window && (
          <button
            onClick={handleNotifToggle}
            disabled={notifLoading}
            className="btn-retro"
            style={{ opacity: notifLoading ? 0.4 : 1, background: "var(--retro-pink-pale)" }}
          >
            <span>{notifEnabled ? "🔔" : "🔕"}</span>
            <span>
              {notifLoading ? "UPDATING…" : notifEnabled ? "NOTIFICATIONS ON — MUTE" : "GET RACE NOTIFICATIONS"}
            </span>
          </button>
        )}

        <Link
          to={`/scrum/${id}/lobby`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 11, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "var(--ink)",
            textDecoration: "underline", padding: "12px",
          }}
        >
          BACK TO THE PEN
        </Link>
      </div>
    </div>
  );

  async function handleNotifToggle() {
    if (!userId) return;
    setNotifLoading(true);
    try {
      if (notifEnabled) {
        await unregisterPush(userId);
        setNotifEnabled(false);
        toast.success("Notifications off");
      } else {
        const ok = await registerPush(userId);
        if (ok) {
          setNotifEnabled(true);
          toast.success("Notifications on");
        } else {
          toast.error("Couldn't enable notifications — check your browser settings");
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleRefresh() {
    if (!scrum?.cardId) return;
    setRefreshing(true);
    try {
      await syncResults(scrum.cardId);
      await buildLines(viewUserId ?? userId ?? "");
      toast.success("Results updated");
    } catch {
      await buildLines(viewUserId ?? userId ?? "");
    } finally {
      setRefreshing(false);
    }
  }
};

export default Slip;
