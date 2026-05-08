import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncResults } from "@/lib/racingApi";
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
  const [refreshing, setRefreshing] = useState(false);


  async function buildLines() {
    if (!id) return;
    const picksSnap = await getDocs(
      query(collection(db, "picks"),
        where("scrumId", "==", id),
        where("userId", "==", userId))
    );
    const built: Line[] = [];
    for (const pickDoc of picksSnap.docs) {
      const pick = pickDoc.data();
      const raceDoc = await getDoc(doc(db, "races", pick.raceId));
      const horseDoc = await getDoc(doc(db, "horses", pick.horseId));
      const race = raceDoc.data();
      const horse = horseDoc.data();
      const status = getStatus(race?.status ?? "upcoming", pick.horseId, race?.winners);
      const winners = race?.winners;
      const fetchWinner = async (horseId: string | undefined) => {
        if (!horseId) return null;
        const d = await getDoc(doc(db, "horses", horseId));
        if (!d.exists()) return null;
        return { number: d.data().number, name: d.data().name };
      };
      const podium = {
        first: await fetchWinner(winners?.first),
        second: await fetchWinner(winners?.second),
        third: await fetchWinner(winners?.third),
      };
      built.push({
        raceNumber: race?.raceNumber ?? 0,
        horseName: horse?.name ?? "—",
        horseNumber: horse?.number ?? 0,
        offTime: race?.offTime ?? null,
        status,
        points: pointsFor(status),
        podium,
      });
    }
    setLines(built.sort((a, b) => a.raceNumber - b.raceNumber));
  }

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

    // Auto-refresh results every 30 seconds
    const interval = setInterval(() => buildLines(), 30000);

    return () => { unsub(); clearInterval(interval); };
  }, [id]);

  const total = lines.reduce((sum, l) => sum + l.points, 0);

  async function handleRefresh() {
    if (!scrum?.cardId) return;
    setRefreshing(true);
    try {
      await syncResults(scrum.cardId);
      await buildLines();
      toast.success("Results updated");
    } catch (err: any) {
      // Sync may fail on free plan — still refresh the display
      await buildLines();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      <div className="animate-print relative w-full max-w-md bg-white border-brutalist ticket-clip overflow-hidden">
        <div style={{
          position: "absolute", left: -10, top: "20%",
          width: 20, height: 20, background: "#f9f9f9",
          borderRadius: "50%", borderRight: "2.67px solid black", zIndex: 10,
        }} />
        <div style={{
          position: "absolute", right: -10, top: "20%",
          width: 20, height: 20, background: "#f9f9f9",
          borderRadius: "50%", borderLeft: "2.67px solid black", zIndex: 10,
        }} />

        <div className="p-6 pt-10 border-b-[2.67px] border-dashed border-primary flex flex-col items-center gap-3">
          <span className="text-headline-lg uppercase text-center leading-tight">
            {card?.trackName ?? "—"}
          </span>
          <span className="text-label-caps text-muted-foreground uppercase">
            {scrum?.name ?? "—"}
          </span>
        </div>

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
                className={`flex justify-between items-center border-b border-primary/10 pb-3 last:border-0 ${isOut ? "opacity-50" : ""}`}
              >
                <div className="flex flex-col">
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
                    {(["first","second","third"] as const).map((pos, pi) => {
                      const horse = l.podium[pos];
                      const label = ["1ST","2ND","3RD"][pi];
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
                <StatusBadge status={l.status} />
              </div>
            );
          })}
        </div>

        {lines.length > 0 && (
          <div className="mx-6 mb-6 border-t-[2.67px] border-primary pt-3 flex justify-between text-headline-md uppercase">
            <span>TOTAL</span>
            <span>{total} PTS</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-md mt-6 flex flex-col gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full h-12 border-brutalist text-label-caps uppercase disabled:opacity-40 transition-none"
        >
          {refreshing ? "REFRESHING…" : "REFRESH RESULTS"}
        </button>
        <Link
          to="/"
          className="w-full h-12 flex items-center justify-center text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
        >
          BACK TO PADDOCK
        </Link>
      </div>
    </div>
  );
};

export default Slip;
