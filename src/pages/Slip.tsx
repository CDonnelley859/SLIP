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

const StatusBadge = ({ status }: { status: LineStatus }) => {
  if (status === "RUNNING") return (
    <div className="flex items-center gap-1">
      <div className="w-4 h-4 bg-primary animate-pulse" />
      <span className="text-label-caps">RUNNING</span>
    </div>
  );
  if (status === "PENDING") return <span className="text-label-caps opacity-30">PENDING</span>;
  if (status === "WIN") return <div className="text-headline-md uppercase stamp-win">WIN</div>;
  if (status === "PLACE") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-8deg)" }}>PLACE</div>
  );
  if (status === "SHOW") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-6deg)" }}>SHOW</div>
  );
  return <div className="text-label-caps text-muted-foreground">OUT</div>;
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

      // Load all members, own first
      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("scrumId", "==", id))
      );
      const allMembers = membersSnap.docs.map(d => ({
        userId: d.data().userId,
        handle: d.data().handle ?? "Anonymous",
      }));
      // Put own user at index 0
      const sorted = [
        ...allMembers.filter(m => m.userId === userId),
        ...allMembers.filter(m => m.userId !== userId),
      ];
      setPlayers(sorted);

      // Auto-sync results on open so the slip is always fresh
      try { await syncResults(scrumData.cardId); } catch { /* silent */ }
      await buildLines(sorted[0]?.userId ?? userId ?? "");
    })();

    const unsub = onSnapshot(
      query(collection(db, "picks"), where("scrumId", "==", id)),
      () => {
        if (viewUserId) buildLines(viewUserId);
      }
    );

    const interval = setInterval(() => {
      if (viewUserId) buildLines(viewUserId);
    }, 30000);

    return () => { unsub(); clearInterval(interval); };
  }, [id]);

  // Reload lines when player changes
  useEffect(() => {
    if (viewUserId) buildLines(viewUserId);
  }, [playerIdx]);

  function goToPlayer(dir: "forward" | "back") {
    setSlideDir(dir);
    setSlideKey(k => k + 1);
    setPlayerIdx(i =>
      dir === "forward"
        ? Math.min(players.length - 1, i + 1)
        : Math.max(0, i - 1)
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">

      {/* Player dots */}
      {players.length > 1 && (
        <div className="flex gap-2 mb-4">
          {players.map((p, i) => (
            <button
              key={p.userId}
              onClick={() => {
                setSlideDir(i > playerIdx ? "forward" : "back");
                setSlideKey(k => k + 1);
                setPlayerIdx(i);
              }}
              className={`w-2.5 h-2.5 rounded-full border border-primary transition-none ${i === playerIdx ? "bg-primary" : "bg-transparent"}`}
            />
          ))}
        </div>
      )}

      <div
        key={slideKey}
        className={`relative w-full max-w-md bg-white border-brutalist ticket-clip overflow-hidden ${slideKey === 0 ? "animate-print" : slideDir === "forward" ? "animate-slide-forward" : "animate-slide-back"}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Punch holes */}
        <div style={{
          position: "absolute", left: -10, top: "15%",
          width: 20, height: 20, background: "#f9f9f9",
          borderRadius: "50%", borderRight: "2.67px solid black", zIndex: 10,
        }} />
        <div style={{
          position: "absolute", right: -10, top: "15%",
          width: 20, height: 20, background: "#f9f9f9",
          borderRadius: "50%", borderLeft: "2.67px solid black", zIndex: 10,
        }} />

        {/* ── STUB ── track, group, date, total, rank */}
        <div className="p-6 pt-8 border-b-[2.67px] border-dashed border-primary">
          <div className="flex flex-col items-center gap-1 mb-5">
            {currentPlayer && (
              <span className="text-label-caps uppercase border border-primary px-2 py-0.5 mb-1">
                {isOwnSlip ? "YOUR SLIP" : `${currentPlayer.handle}'S SLIP`}
              </span>
            )}
            <span className="text-headline-lg uppercase text-center leading-tight">
              {card?.trackName ?? "—"}
            </span>
            <span className="text-label-caps text-muted-foreground uppercase">
              {scrum?.name ?? "—"}
            </span>
            {card?.raceDate && (
              <span className="text-label-caps text-muted-foreground">
                {new Date(card.raceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>

          <div className="flex justify-between items-end border-t border-primary/20 pt-4">
            <div>
              <span className="text-label-caps text-muted-foreground uppercase block">TOTAL</span>
              <span className="text-[40px] font-black leading-none">{isFullyPending ? "—" : total}</span>
              <span className="text-label-caps text-muted-foreground uppercase"> PTS</span>
            </div>
            {rank && (
              <div className="text-right">
                <span className="text-label-caps text-muted-foreground uppercase block">RANK</span>
                <span className="text-headline-md font-black">#{rank.position}</span>
                <span className="text-label-caps text-muted-foreground"> OF {rank.total}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── BODY ── race lines */}
        <div className="p-6 space-y-4">
          {lines.length === 0 && (
            <p className="text-label-caps text-muted-foreground uppercase text-center py-4">
              No picks yet — head to the Daily Gallop
            </p>
          )}
          {lines.map((l, i) => {
            const isOut = l.status === "OUT";
            const isPending = l.status === "PENDING";
            const isRunning = l.status === "RUNNING";
            const isSettled = l.status === "WIN" || l.status === "PLACE" || l.status === "SHOW";
            return (
              <div
                key={i}
                className={`flex items-start gap-3 border-b border-primary/10 pb-3 last:border-0 ${isOut ? "opacity-50" : ""}`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-label-caps text-muted-foreground">
                    RACE {String(l.raceNumber).padStart(2, "0")}
                    {l.offTime && ` · ${new Date(l.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                  <span className={`text-body-lg ${isOut ? "line-through" : ""}`}>
                    {l.horseNumber}. {l.horseName}
                  </span>
                  <span className={`text-label-caps mt-1 ${isSettled ? "text-primary" : "text-muted-foreground"}`}>
                    {isPending && "PENDING…"}
                    {isRunning && "IN PROGRESS…"}
                    {isOut && "+0 PTS"}
                    {isSettled && `+${l.points} PTS`}
                  </span>
                  <div className="flex gap-2 mt-2">
                    {(["first", "second", "third"] as const).map((pos, pi) => {
                      const horse = l.podium[pos];
                      const label = ["1ST", "2ND", "3RD"][pi];
                      return (
                        <div key={pos} className="flex-1 border border-primary/30 p-1 text-center">
                          <div className="text-[9px] text-muted-foreground font-mono uppercase">{label}</div>
                          <div className="text-[11px] font-bold uppercase leading-tight mt-0.5 truncate">
                            {horse ? `${horse.number}. ${horse.name}` : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="shrink-0 pt-1 pr-1">
                  <StatusBadge status={l.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Swipe hint */}
      {players.length > 1 && (
        <p className="text-label-caps text-muted-foreground uppercase mt-3 opacity-50">
          ← SWIPE TO SEE OTHER SLIPS →
        </p>
      )}

      <div className="w-full max-w-md mt-6 flex flex-col gap-3">
        {isOwnSlip && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full h-12 border-brutalist text-label-caps uppercase disabled:opacity-40 transition-none"
          >
            {refreshing ? "REFRESHING…" : "REFRESH RESULTS"}
          </button>
        )}

        {isOwnSlip && "Notification" in window && (
          <button
            onClick={handleNotifToggle}
            disabled={notifLoading}
            className="w-full h-12 border-brutalist text-label-caps uppercase disabled:opacity-40 transition-none flex items-center justify-center gap-2"
          >
            <span>{notifEnabled ? "🔔" : "🔕"}</span>
            <span>
              {notifLoading
                ? "UPDATING…"
                : notifEnabled
                  ? "NOTIFICATIONS ON — TAP TO MUTE"
                  : "GET RACE NOTIFICATIONS"}
            </span>
          </button>
        )}

        <Link
          to={`/scrum/${id}/lobby`}
          className="w-full h-12 flex items-center justify-center text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
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
          toast.success("Notifications on — we'll ping you when results are in");
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
