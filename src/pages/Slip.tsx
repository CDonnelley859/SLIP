import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncResults } from "@/lib/racingApi";
import { settleVirtualRaces } from "@/lib/virtualTrack";
import { registerPush, unregisterPush, isPushRegistered } from "@/lib/notifications";
import {
  doc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc,
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

// ── File-local components ──

const ScalloppedEdge = ({ side }: { side: "top" | "bottom" }) => (
  <svg viewBox="0 0 400 8" preserveAspectRatio="none" style={{
    position: "absolute" as const, left: 0, right: 0, width: "100%", height: 8, display: "block", zIndex: 4,
    ...(side === "top" ? { top: 0, transform: "translateY(-1px)" } : { bottom: 0, transform: "translateY(1px) scaleY(-1)" }),
  }}>
    {Array.from({ length: 25 }).map((_, i) => (
      <circle key={i} cx={8 + i * 16} cy={0} r={4} fill="var(--green)" stroke="rgba(245,232,223,0.4)" strokeWidth={1.5} />
    ))}
  </svg>
);

const Stamp = ({ kind }: { kind: string }) => {
  const map: Record<string, { label: string; color: string; rot: number; dashed?: boolean; dim?: boolean }> = {
    WIN:     { label: "WIN",     color: "var(--pink)",              rot: -8 },
    PLACE:   { label: "PLACE",   color: "var(--cream)",             rot: -5 },
    SHOW:    { label: "SHOW",    color: "var(--cream)",             rot: -3 },
    OUT:     { label: "OUT",     color: "rgba(245,232,223,0.5)",    rot: 4, dashed: true, dim: true },
    PENDING: { label: "PENDING", color: "rgba(245,232,223,0.4)",    rot: 0, dim: true },
    RUNNING: { label: "NOW",     color: "var(--cream)",             rot: -4 },
  };
  const s = map[kind] ?? map.PENDING;
  return (
    <span className="display" style={{
      display: "inline-block",
      border: `2.5px ${s.dashed ? "dashed" : "solid"} ${s.color}`,
      color: s.color, padding: "3px 10px 2px",
      fontSize: 14, letterSpacing: ".06em", transform: `rotate(${s.rot}deg)`,
      background: "transparent", opacity: s.dim ? 0.5 : 1, flexShrink: 0,
    }}>{s.label}</span>
  );
};

// ── Main component ──

const Slip = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const printOnLoad = !!(location.state as any)?.printOnLoad;
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
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(printOnLoad); // blank until animation if coming from Gallop

  // Print animation — randomly picks one of three receipt-feed styles.
  const printAnim = useMemo(() => {
    const vh    = window.innerHeight;
    const start = -(vh + 200);
    const m1    = -Math.round(vh * 0.72);
    const m2    = -Math.round(vh * 0.30);
    const m15   = -Math.round(vh * 0.51);
    const style = Math.floor(Math.random() * 3);
    if (style === 0) {
      return { yKeys: [start, 0] as number[], opKeys: [0, 1] as number[], times: [0, 1] as number[], duration: 1.8, ease: "easeOut" as const };
    } else if (style === 1) {
      return { yKeys: [start, m1, m1, m2, m2, 0] as number[], opKeys: [0, 1, 1, 1, 1, 1] as number[], times: [0, 0.22, 0.40, 0.64, 0.80, 1] as number[], duration: 2.4, ease: "linear" as const };
    } else {
      return { yKeys: [start, m1, m1, m15, m15, m2, m2, 0] as number[], opKeys: [0, 1, 1, 1, 1, 1, 1, 1] as number[], times: [0, 0.14, 0.27, 0.41, 0.54, 0.68, 0.81, 1] as number[], duration: 3.0, ease: "linear" as const };
    }
  }, []);

  const touchStartX = useRef<number | null>(null);
  // Always-current ref so onSnapshot/interval don't capture a stale viewUserId
  const viewUserIdRef = useRef<string>("");
  // Generation counter — incremented before each buildLines call so out-of-order
  // responses from rapid player swipes are silently discarded
  const buildGenRef = useRef(0);

  const currentPlayer = players[playerIdx];
  const viewUserId = currentPlayer?.userId ?? userId;
  const isOwnSlip = viewUserId === userId;

  // Keep the ref in sync with the derived value
  useEffect(() => { viewUserIdRef.current = viewUserId ?? ""; }, [viewUserId]);



  async function buildLines(forUserId: string) {
    if (!id) return;
    const gen = ++buildGenRef.current;
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
      const raceExists = raceDocs[i].exists();
      const horseExists = horseDocs[i].exists();
      const race = raceDocs[i].data();
      const horse = horseDocs[i].data();
      const winners = race?.winners;

      let status: LineStatus;
      if (!raceExists) {
        // Race doc deleted (yesterday's virtual race wiped by daily reset).
        // Reconstruct status from the points written to the pick at settle time.
        if (pick.settled) {
          const pts = pick.points ?? 0;
          if (pts === 5) status = "WIN";
          else if (pts === 3) status = "PLACE";
          else if (pts === 1) status = "SHOW";
          else status = "OUT";
        } else {
          status = "PENDING";
        }
      } else {
        status = getStatus(race?.status ?? "upcoming", pick.horseId, winners);
      }

      // Fallbacks from data stored on the pick itself at pick time
      const raceNumFallback = pick.raceNumber
        ?? parseInt(pick.raceId?.match(/-r(\d+)$/)?.[1] ?? "0", 10);

      return {
        raceNumber: race?.raceNumber ?? raceNumFallback,
        horseName: horse?.name ?? pick.horseName ?? "—",
        horseNumber: horseExists ? (horse?.number ?? 0) : 0,
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
    // Discard if a newer call completed first (rapid player swipes)
    if (gen !== buildGenRef.current) return;
    setLines(sorted);
    setReady(true);

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

      if (!cardDoc.data()?.isVirtual) {
        try { await syncResults(scrumData.cardId); } catch { }
      }
      await buildLines(sorted[0]?.userId ?? userId ?? "");
    })();

    const unsub = onSnapshot(
      query(collection(db, "picks"), where("scrumId", "==", id)),
      () => { const uid = viewUserIdRef.current; if (uid) buildLines(uid); }
    );
    const interval = setInterval(() => {
      const uid = viewUserIdRef.current; if (uid) buildLines(uid);
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

  const myTotal = lines.reduce((sum, l) => sum + l.points, 0);
  const myRank = rank?.position ?? null;
  const playerCount = rank?.total ?? 0;
  const isFullyPending = lines.length > 0 && lines.every(l => l.status === "PENDING");

  const dateLabel = card?.raceDate
    ? new Date(card.raceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "";
  const postTimeLabel = card?.postTime
    ? new Date(card.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

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

  function handleShareSlip() {
    const playerLabel = isOwnSlip ? "MY SLIP" : `${currentPlayer?.handle ?? "—"}'S SLIP`;
    const venue = card?.trackName ?? "—";
    const group = scrum?.name ? ` · ${scrum.name}` : "";
    const dateStr = card?.raceDate
      ? new Date(card.raceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
      : "";

    const resultIcon = (s: LineStatus) => {
      if (s === "WIN") return "🥇";
      if (s === "PLACE") return "🥈";
      if (s === "SHOW") return "🥉";
      if (s === "RUNNING") return "▶";
      if (s === "PENDING") return "⏳";
      return "❌";
    };

    const pickLines = lines.map(l =>
      `R${String(l.raceNumber).padStart(2, "0")} ${l.horseName} ${resultIcon(l.status)} ${l.status}`
    ).join("\n");

    const totalLine = isFullyPending ? "" : `\nTOTAL: ${myTotal} PTS${myRank ? `  |  RANK: #${myRank} OF ${playerCount}` : ""}`;

    const url = `https://slip-racing.vercel.app/scrum/${id}/slip`;

    const text = `${playerLabel} — ${venue}${group}${dateStr ? "\n" + dateStr : ""}\n\n${pickLines}${totalLine}`;

    if (navigator.share) {
      navigator.share({ title: "SLIP", text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n\n${url}`).then(() => toast.success("Slip copied!"));
    }
  }

  // Spindle send — computed from lines and scrum state
  const allSettled = lines.length > 0 && lines.every(l => l.status !== "PENDING" && l.status !== "RUNNING");
  const alreadySent = scrum?.spindleSent?.[userId ?? ""] === true;
  const readyToSend = isOwnSlip && allSettled && !alreadySent;

  async function handleSendToSpindle() {
    if (!id || !userId || sending) return;
    setSending(true);
    // Animation plays — Firestore write + navigate happens in onSendAnimComplete
  }

  async function onSendAnimComplete() {
    if (!sending) return;
    try {
      await updateDoc(doc(db, "scrums", id!), {
        [`spindleSent.${userId}`]: true,
      });
    } catch { }
    navigate("/spindle", { state: { newScrumId: id } });
  }

  async function handleRefresh() {
    if (!scrum?.cardId) return;
    setRefreshing(true);
    try {
      if (card?.isVirtual) {
        await settleVirtualRaces();
      } else {
        await syncResults(scrum.cardId);
      }
      await buildLines(viewUserId ?? userId ?? "");
      toast.success("Results updated");
    } catch {
      await buildLines(viewUserId ?? userId ?? "");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className="min-h-screen halftone-bg halftone-loose flex flex-col items-center"
      style={{ background: "var(--green)", padding: "0 0 80px", touchAction: "pan-y" }}
    >
      {/* ── PAGE HEADER ── */}
      {!printing && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
        }}
      >
        <Link
          to={scrum?.megaSlipId ? `/mega/${scrum.megaSlipId}/hub` : `/scrum/${id}/lobby`}
          className="label"
          style={{ color: "var(--cream)", textDecoration: "none", flex: 1 }}
        >
          {scrum?.megaSlipId ? "← HUB" : "← PADDOCK"}
        </Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)", textAlign: "center" }}>THE SLIP</span>
        <div style={{ flex: 1 }} />
      </motion.div>
      )}

      {/* ── PLAYER DOTS ── */}
      {!printing && players.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ display: "flex", marginBottom: 4 }}>
          {players.map((p, i) => (
            <button
              key={p.userId}
              onClick={() => {
                setSlideDir(i > playerIdx ? "forward" : "back");
                setSlideKey(k => k + 1);
                setPlayerIdx(i);
              }}
              aria-label={p.handle}
              style={{
                /* 40×40 tap area with a small visual dot centred inside */
                width: 40, height: 40, borderRadius: "50%",
                background: "transparent", border: 0,
                cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{
                display: "block", width: 10, height: 10, borderRadius: "50%",
                border: `2px solid ${i === playerIdx ? "var(--cream)" : "rgba(245,232,223,0.4)"}`,
                background: i === playerIdx ? "var(--cream)" : "transparent",
              }} />
            </button>
          ))}
        </motion.div>
      )}

      {/* ── TICKET ── */}
      <AnimatePresence mode="wait" custom={slideDir}>
      {ready && (
      <motion.div
        key={slideKey}
        custom={slideDir}
        variants={{
          enter: (dir: string) => ({ x: dir === "forward" ? 48 : -48, opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (dir: string) => ({ x: dir === "forward" ? -48 : 48, opacity: 0 }),
        }}
        initial={slideKey === 0 ? { opacity: 1, x: 0 } : "enter"}
        animate={slideKey === 0 ? { opacity: 1, x: 0 } : "center"}
        exit="exit"
        transition={{ duration: 0.22, ease: [0.25, 0, 0.25, 1] }}
        style={{ width: "calc(100% - 36px)", maxWidth: 420 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Send-to-spindle animation — slides the whole ticket off to the right */}
        <motion.div
          initial={{ x: 0, opacity: 1 }}
          animate={sending ? { x: window.innerWidth + 120, opacity: 0 } : { x: 0, opacity: 1 }}
          transition={sending ? { duration: 0.42, ease: [0.4, 0, 1, 1] } : { duration: 0 }}
          onAnimationComplete={() => { if (sending) onSendAnimComplete(); }}
        >

        {/* Print animation — feeds ticket down from above, only on PRINT SLIP from Gallop */}
        <motion.div
          initial={printOnLoad ? { y: printAnim.yKeys[0], opacity: 0 } : false}
          animate={printOnLoad ? { y: printAnim.yKeys, opacity: printAnim.opKeys } : false}
          transition={printOnLoad ? { delay: 0.3, duration: printAnim.duration, times: printAnim.times, ease: printAnim.ease } : undefined}
          onAnimationComplete={() => { if (printing) setPrinting(false); }}
        >

        {/* Ticket */}
        <div style={{ position: "relative" }}>
          {/* ticket */}
          <div style={{ position: "relative", zIndex: 1, background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", color: "var(--cream)", boxShadow: "6px 6px 0 var(--cream)" }}>
            <ScalloppedEdge side="top" />
            <ScalloppedEdge side="bottom" />
            <div style={{ padding: "20px 18px 22px" }}>

              {/* player badge */}
              {currentPlayer && (
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <span className="mono" style={{
                    border: "2px solid rgba(245,232,223,0.4)", padding: "3px 10px",
                    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--cream)",
                  }}>
                    {isOwnSlip ? "YOUR SLIP" : `${currentPlayer.handle}'S SLIP`}
                  </span>
                </div>
              )}

              {/* venue */}
              <div className="display" style={{ fontSize: 44, lineHeight: 0.9, textAlign: "center" }}>{card?.trackName ?? "—"}</div>

              {/* date + post time */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div className="perf" style={{ width: 30 }} />
                <span className="label-sm">{dateLabel} · POST {postTimeLabel}</span>
                <div className="perf" style={{ width: 30 }} />
              </div>

              {scrum?.name && (
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <span className="label-sm" style={{ opacity: 0.5 }}>{scrum.name}</span>
                </div>
              )}

              {/* TOTAL / RANK */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, padding: "0 6px" }}>
                <div>
                  <div className="label-sm" style={{ opacity: 0.65 }}>TOTAL</div>
                  <div className="display" style={{ fontSize: 44, lineHeight: 0.9 }}>
                    {isFullyPending ? "—" : myTotal}<span style={{ fontSize: 13, marginLeft: 6, opacity: 0.6 }}>PTS</span>
                  </div>
                </div>
                {myRank && (
                  <div style={{ textAlign: "right" }}>
                    <div className="label-sm" style={{ opacity: 0.65 }}>RANK</div>
                    <div className="display" style={{ fontSize: 44, lineHeight: 0.9 }}>
                      #{myRank}<span style={{ fontSize: 13, marginLeft: 6, opacity: 0.6 }}>OF {playerCount}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* perforated tear */}
              <div style={{ display: "flex", alignItems: "center", margin: "18px -22px 14px" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", marginLeft: -10 }} />
                <div className="perf" style={{ flex: 1, opacity: 0.4 }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--green)", border: "3px solid rgba(245,232,223,0.4)", marginRight: -10 }} />
              </div>

              {/* pick cards */}
              {lines.length === 0 && (
                <p className="label-sm" style={{ textAlign: "center", paddingBlock: 16, opacity: 0.5 }}>
                  No picks yet — head to the Daily Gallop
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lines.map(line => (
                  <div key={line.raceNumber} style={{ border: "1.5px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                          <span className="mono" style={{ background: "rgba(245,232,223,0.2)", color: "var(--cream)", padding: "2px 6px", fontSize: 9, letterSpacing: ".18em", border: "1px solid rgba(245,232,223,0.3)" }}>
                            RACE {String(line.raceNumber).padStart(2, "0")}
                          </span>
                          <span className="mono" style={{ fontSize: 10, opacity: 0.6, color: "var(--cream)" }}>
                            {line.offTime ? new Date(line.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </div>
                        <div className="display" style={{ fontSize: 16, lineHeight: 1, marginTop: 4, color: "var(--cream)",
                          textDecoration: line.status === "OUT" ? "line-through" : "none",
                          opacity: line.status === "OUT" ? 0.45 : 1 }}>
                          {line.horseNumber}. {line.horseName}
                        </div>
                      </div>
                      <Stamp kind={line.status} />
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      {(["1ST", "2ND", "3RD"] as const).map((pos, idx) => {
                        const w = idx === 0 ? line.podium?.first : idx === 1 ? line.podium?.second : line.podium?.third;
                        return (
                          <div key={pos} style={{ flex: 1, border: "1.5px solid rgba(245,232,223,0.25)", padding: "5px 6px", textAlign: "center", background: "rgba(245,232,223,0.08)", opacity: w ? 1 : 0.55 }}>
                            <div className="label-sm" style={{ color: "var(--cream)" }}>{pos}</div>
                            <div className="display" style={{ fontSize: 12, marginTop: 1, color: "var(--cream)" }}>{w ? w.name : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
        </motion.div>{/* /print animation wrapper */}
        </motion.div>{/* /send animation wrapper */}
      </motion.div>
      )}
      </AnimatePresence>

      {/* swipe hint */}
      {!printing && players.length > 1 && (
        <motion.p
          className="label-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ marginTop: 12, color: "var(--cream)" }}
        >
          ← SWIPE TO SEE OTHER SLIPS →
        </motion.p>
      )}

      {/* ── STICKY SEND FOOTER — visible without scrolling when ready to send ── */}
      {!printing && readyToSend && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
            background: "var(--green)", borderTop: "3px solid var(--pink)",
            padding: "14px 18px 20px",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <button
            onClick={handleSendToSpindle}
            disabled={sending}
            className="btn-retro"
            style={{
              background: "var(--pink)", color: "var(--ink)",
              border: "3px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)",
              fontSize: 20, letterSpacing: "0.06em",
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sending ? "SENDING…" : "SEND TO SPINDLE →"}
          </button>
          <Link
            to={scrum?.megaSlipId ? `/mega/${scrum.megaSlipId}/hub` : `/scrum/${id}/lobby`}
            className="label"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--cream)", textDecoration: "underline", padding: "4px",
            }}
          >
            {scrum?.megaSlipId ? "BACK TO HUB" : "BACK TO THE PEN"}
          </Link>
        </motion.div>
      )}

      {/* action buttons */}
      {!printing && <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ width: "calc(100% - 36px)", maxWidth: 420, marginTop: 20, display: "flex", flexDirection: "column", gap: 10,
          paddingBottom: readyToSend ? 120 : 0,
        }}
      >
        {readyToSend ? null : (
          /* ── NORMAL BUTTONS ── */
          <>
            {isOwnSlip && !allSettled && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-retro"
                style={{ opacity: refreshing ? 0.4 : 1, background: "var(--green)", color: "var(--cream)", border: "3px solid rgba(245,232,223,0.3)", boxShadow: "none" }}
              >
                {refreshing ? "REFRESHING…" : "↻ REFRESH RESULTS"}
              </button>
            )}

            {lines.length > 0 && (
              <button
                onClick={handleShareSlip}
                className="btn-retro"
                style={{ background: "var(--pink)", color: "var(--ink)", border: "3px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)" }}
              >
                ↗ SHARE {isOwnSlip ? "MY" : `${currentPlayer?.handle?.toUpperCase() ?? ""}'S`} SLIP
              </button>
            )}

            {isOwnSlip && !allSettled && "Notification" in window && (
              <button
                onClick={handleNotifToggle}
                disabled={notifLoading}
                className="btn-retro"
                style={{ opacity: notifLoading ? 0.4 : 1, background: notifEnabled ? "var(--pink)" : "var(--green)", color: notifEnabled ? "var(--ink)" : "var(--cream)", border: "3px solid rgba(245,232,223,0.3)", boxShadow: "none" }}
              >
                <span>{notifEnabled ? "🔔" : "🔕"}</span>
                <span>
                  {notifLoading ? "UPDATING…" : notifEnabled ? "NOTIFICATIONS ON — MUTE" : "GET RACE NOTIFICATIONS"}
                </span>
              </button>
            )}

            {alreadySent && (
              <div className="label-sm" style={{ textAlign: "center", opacity: 0.5, color: "var(--cream)" }}>
                SLIP IS ON THE SPINDLE
              </div>
            )}

            {/* Change picks — only show when races are still open */}
            {isOwnSlip && !allSettled && (
              <Link
                to={`/scrum/${id}/gallop`}
                className="label"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--cream)", textDecoration: "underline", padding: "8px",
                }}
              >
                ✏ CHANGE PICKS
              </Link>
            )}

            <Link
              to={scrum?.megaSlipId ? `/mega/${scrum.megaSlipId}/hub` : `/scrum/${id}/lobby`}
              className="label"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--cream)", textDecoration: "underline", padding: "12px",
              }}
            >
              {scrum?.megaSlipId ? "BACK TO HUB" : "BACK TO THE PEN"}
            </Link>
          </>
        )}
      </motion.div>}
    </div>
  );
};

export default Slip;
