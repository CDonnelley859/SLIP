import { useEffect, useState } from "react";
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
  const [lines, setLines] = useState<Line[]>([]);
  const [rank, setRank] = useState<{ position: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  async function buildLines() {
    if (!id) return;
    const [picksSnap, allPicksSnap] = await Promise.all([
      getDocs(query(collection(db, "picks"), where("scrumId", "==", id), where("userId", "==", userId))),
      getDocs(query(collection(db, "picks"), where("scrumId", "==", id))),
    ]);

    const pickData = picksSnap.docs.map(p => p.data());

    // Fetch all races and horses in parallel
    const [raceDocs, horseDocs] = await Promise.all([
      Promise.all(pickData.map(p => getDoc(doc(db, "races", p.raceId)))),
      Promise.all(pickData.map(p => getDoc(doc(db, "horses", p.horseId)))),
    ]);

    // Collect unique winner horse IDs and fetch in parallel
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

    // Calculate rank
    const myTotal = sorted.reduce((sum, l) => sum + l.points, 0);
    const pointsByUser: Record<string, number> = {};
    allPicksSnap.docs.forEach(p => {
      const uid = p.data().userId;
      pointsByUser[uid] = (pointsByUser[uid] ?? 0) + (p.data().points ?? 0);
    });
    const allTotals = Object.values(pointsByUser).sort((a, b) => b - a);
    const position = allTotals.indexOf(myTotal) + 1;
    if (position > 0 && allTotals.length > 1) {
      setRank({ position, total: allTotals.length });
    }
  }

  // Check whether push is already registered on mount
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
      await buildLines();
    })();

    const unsub = onSnapshot(
      query(collection(db, "picks"), where("scrumId", "==", id)),
      () => buildLines()
    );

    const interval = setInterval(() => buildLines(), 30000);
    return () => { unsub(); clearInterval(interval); };
  }, [id]);

  const total = lines.reduce((sum, l) => sum + l.points, 0);
  const isFullyPending = lines.length > 0 && lines.every(l => l.status === "PENDING");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      <div className="animate-print relative w-full max-w-md bg-white border-brutalist ticket-clip overflow-hidden">
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
          {/* Venue + group centred at top */}
          <div className="flex flex-col items-center gap-1 mb-5">
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

          {/* Points + rank row */}
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

      <div className="w-full max-w-md mt-6 flex flex-col gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full h-12 border-brutalist text-label-caps uppercase disabled:opacity-40 transition-none"
        >
          {refreshing ? "REFRESHING…" : "REFRESH RESULTS"}
        </button>

        {"Notification" in window && (
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
          to="/"
          className="w-full h-12 flex items-center justify-center text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
        >
          BACK TO PADDOCK
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
      await buildLines();
      toast.success("Results updated");
    } catch {
      await buildLines();
    } finally {
      setRefreshing(false);
    }
  }
};

export default Slip;
