import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { syncResults } from "@/lib/racingApi";
import { toast } from "sonner";

type LineStatus = "WIN" | "PLACE" | "SHOW" | "OUT" | "RUNNING" | "PENDING";

type Line = {
  raceNumber: number;
  horseName: string;
  horseNumber: number;
  status: LineStatus;
  points: number;
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
  if (status === "PENDING") return (
    <span className="text-label-caps opacity-30">PENDING</span>
  );
  if (status === "WIN") return (
    <div className="text-headline-md uppercase stamp-win">WIN</div>
  );
  if (status === "PLACE") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-8deg)" }}>
      PLACE
    </div>
  );
  if (status === "SHOW") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-6deg)" }}>
      SHOW
    </div>
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

  const serial = id
    ? `${id.slice(0, 3).toUpperCase()} ${id.slice(3, 6).toUpperCase()}`
    : "--- ---";

  async function loadLines(scrumData: any) {
    const { data: picks } = await supabase
      .from("picks")
      .select("race_id, horse_id, points, races(race_number, status, winners), horses(name, number)")
      .eq("scrum_id", id!)
      .eq("user_id", userId);

    const built: Line[] = (picks ?? []).map((p: any) => {
      const race = p.races;
      const horse = p.horses;
      const status = getStatus(race?.status ?? "upcoming", p.horse_id, race?.winners);
      return {
        raceNumber: race?.race_number ?? 0,
        horseName: horse?.name ?? "—",
        horseNumber: horse?.number ?? 0,
        status,
        points: pointsFor(status),
      };
    });

    setLines(built.sort((a, b) => a.raceNumber - b.raceNumber));
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      const { data: scrumData } = await supabase
        .from("scrums")
        .select("card_id, name, cards(track_name)")
        .eq("id", id)
        .single();

      if (!scrumData) return;
      setScrum(scrumData);
      setCard((scrumData as any).cards);
      await loadLines(scrumData);
    })();

    const channel = supabase
      .channel(`picks_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `scrum_id=eq.${id}` },
        () => { loadLines(null); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const total = lines.reduce((sum, l) => sum + l.points, 0);

  async function handleRefresh() {
    if (!scrum?.card_id) return;
    setRefreshing(true);
    try {
      await syncResults(scrum.card_id);
      toast.success("Results updated");
      await loadLines(scrum);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      {/* Ticket */}
      <div className="animate-print relative w-full max-w-md bg-white border-brutalist ticket-clip overflow-hidden">
        {/* Notches */}
        <div style={{
          position: "absolute", left: -10, top: "20%",
          width: 20, height: 20,
          background: "#f9f9f9", borderRadius: "50%",
          borderRight: "2.67px solid black", zIndex: 10,
        }} />
        <div style={{
          position: "absolute", right: -10, top: "20%",
          width: 20, height: 20,
          background: "#f9f9f9", borderRadius: "50%",
          borderLeft: "2.67px solid black", zIndex: 10,
        }} />

        {/* Stub */}
        <div className="p-6 pt-10 border-b-[2.67px] border-dashed border-primary flex flex-col items-center gap-3">
          <span className="text-headline-lg uppercase text-center leading-tight">
            {card?.track_name ?? "—"}
          </span>
          <span className="text-label-caps text-muted-foreground uppercase">
            {scrum?.name ?? "—"}
          </span>
          <div className="bg-primary text-primary-foreground px-4 py-2 font-mono tracking-widest text-data-mono">
            {serial}
          </div>
        </div>

        {/* Race lines */}
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
                </div>
                <StatusBadge status={l.status} />
              </div>
            );
          })}
        </div>

        {/* Total */}
        {lines.length > 0 && (
          <div className="mx-6 mb-6 border-t-[2.67px] border-primary pt-3 flex justify-between text-headline-md uppercase">
            <span>TOTAL</span>
            <span>{total} PTS</span>
          </div>
        )}
      </div>

      {/* Actions */}
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
