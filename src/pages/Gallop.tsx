import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Horse = { id: string; number: number; name: string; jockey: string | null; odds: string | null };
type Race = { id: string; race_number: number; name: string | null; off_time: string; horses: Horse[] };

const Gallop = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [card, setCard] = useState<any>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: scrum } = await supabase
        .from("scrums")
        .select("card_id, cards(id, track_name, race_date)")
        .eq("id", id)
        .single();

      if (!scrum) return;
      setCard((scrum as any).cards);

      const cardId = scrum.card_id;

      const { data: racesData } = await supabase
        .from("races")
        .select("id, race_number, name, off_time, horses(id, number, name, jockey, odds)")
        .eq("card_id", cardId)
        .order("race_number");

      const list: Race[] = (racesData ?? []).map((r: any) => ({
        id: r.id,
        race_number: r.race_number,
        name: r.name,
        off_time: r.off_time,
        horses: [...(r.horses ?? [])].sort((a: Horse, b: Horse) => a.number - b.number),
      }));
      setRaces(list);

      const { data: existingPicks } = await supabase
        .from("picks")
        .select("race_id, horse_id")
        .eq("scrum_id", id)
        .eq("user_id", userId);

      const map: Record<string, string> = {};
      (existingPicks ?? []).forEach(p => { map[p.race_id] = p.horse_id; });
      setPicks(map);
    })();
  }, [id]);

  const currentRace = races[currentIdx];
  const isLastRace = currentIdx === races.length - 1;
  const allPicked = races.length > 0 && races.every(r => picks[r.id]);
  const currentPick = currentRace ? picks[currentRace.id] : undefined;
  const isLocked = currentRace
    ? new Date(currentRace.off_time).getTime() <= Date.now()
    : false;

  async function handleSubmit() {
    if (!allPicked) { toast.error("Pick a horse in every race"); return; }
    setSubmitting(true);
    try {
      await supabase.from("picks").delete().eq("scrum_id", id!).eq("user_id", userId);

      const rows = Object.entries(picks).map(([raceId, horseId]) => ({
        scrum_id: id!,
        race_id: raceId,
        horse_id: horseId,
        user_id: userId,
        points: null,
      }));
      const { error } = await supabase.from("picks").insert(rows);
      if (error) throw new Error(error.message);

      navigate(`/scrum/${id}/slip`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentRace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-label-caps uppercase text-muted-foreground">Loading card…</p>
      </div>
    );
  }

  const offTime = currentRace.off_time
    ? new Date(currentRace.off_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Newspaper-style header */}
      <header className="w-full border-b-brutalist bg-background px-4 sticky top-0 z-50">
        <div className="flex justify-between items-baseline py-2">
          <h1 className="text-[44px] font-black tracking-tighter leading-none">SLIP</h1>
          <div className="text-label-caps">{card?.race_date ?? ""}</div>
        </div>
        <div className="border-t border-primary/20 pt-1 pb-2 flex justify-between items-center">
          <h2 className="text-[22px] font-black uppercase tracking-tight flex-1 leading-tight">
            {card?.track_name ?? "—"}
          </h2>
          <span className="text-data-mono text-[16px] border-l border-primary/20 pl-2 ml-2">
            {offTime}
          </span>
        </div>
      </header>

      <main className="flex-grow px-4 pt-4 pb-[80px]">
        {/* Race label */}
        <div className="flex justify-between items-end border-b-brutalist mb-3 pb-2">
          <div>
            <span className="text-label-caps text-muted-foreground uppercase">
              Entry {String(currentIdx + 1).padStart(2, "0")} of {String(races.length).padStart(2, "0")}
            </span>
            <h3 className="text-[48px] font-black uppercase leading-none">
              RACE {String(currentRace.race_number).padStart(2, "0")}
            </h3>
          </div>
          <div className="text-right pb-1">
            {currentRace.name && (
              <div className="text-headline-md leading-none uppercase">{currentRace.name}</div>
            )}
            {isLocked && (
              <div className="text-label-caps text-destructive uppercase mt-1">LOCKED</div>
            )}
          </div>
        </div>

        {/* Horses */}
        <div className="border-brutalist divide-y divide-primary/20 bg-background">
          {currentRace.horses.map((h) => {
            const selected = currentPick === h.id;
            return (
              <button
                key={h.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setPicks(p => ({ ...p, [currentRace.id]: h.id }))}
                className={`w-full flex items-center gap-4 px-4 py-3 text-left relative transition-none
                  ${selected ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}
                  ${isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {selected && (
                  <div className="absolute inset-0 x-stamp opacity-10 pointer-events-none" />
                )}
                <span className="text-headline-md w-8 text-center shrink-0">{h.number}</span>
                <div className="flex-1 text-left">
                  <div className="text-body-lg uppercase">{h.name}</div>
                  {h.jockey && (
                    <div className="text-label-caps opacity-60">{h.jockey}</div>
                  )}
                </div>
                <span className="text-body-md font-mono shrink-0">{h.odds ?? "—"}</span>
                {selected && (
                  <span className="text-label-caps border border-current px-1 py-0.5 shrink-0">
                    INKED
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Send to print — only when all races are picked */}
        {allPicked && (
          <div className="mt-6 border-brutalist p-4 bg-background">
            <div className="flex justify-between items-center mb-3 border-b border-primary/20 pb-2">
              <h4 className="text-label-caps uppercase">Selection Slip</h4>
              <span className="text-label-caps text-muted-foreground">
                R1–R{races.length} COMPLETE
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist disabled:opacity-40 transition-none"
            >
              {submitting ? "PRINTING…" : "SEND TO PRINT"}
            </button>
            <p className="text-center text-label-caps text-muted-foreground mt-2 uppercase">
              Confirmation generates your official slip
            </p>
          </div>
        )}
      </main>

      {/* Bottom flipper nav */}
      <div className="fixed bottom-0 left-0 w-full h-[60px] z-50 flex items-center justify-between border-t-brutalist bg-background px-4">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="text-label-caps uppercase disabled:opacity-30 transition-none"
        >
          ← PREV
        </button>
        <div className="text-data-mono font-bold tracking-widest">
          {String(currentIdx + 1).padStart(2, "0")} / {String(races.length).padStart(2, "0")}
        </div>
        <button
          onClick={() => setCurrentIdx(i => Math.min(races.length - 1, i + 1))}
          disabled={isLastRace}
          className="text-label-caps uppercase disabled:opacity-30 transition-none"
        >
          NEXT →
        </button>
      </div>
    </div>
  );
};

export default Gallop;
