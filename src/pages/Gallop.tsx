import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncRunners } from "@/lib/racingApi";
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, writeBatch,
} from "firebase/firestore";
import { toast } from "sonner";

type Horse = { id: string; number: number; name: string; jockey: string | null; trainer: string | null; owner: string | null; form: string | null; lbs: number | null; odds: string | null };

function formatWeight(lbs: number): string {
  const st = Math.floor(lbs / 14);
  const lb = lbs % 14;
  return `${st}-${lb}`;
}
type Race = { id: string; raceNumber: number; name: string | null; offTime: string; horses: Horse[] };

const Gallop = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [card, setCard] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [races, setRaces] = useState<Race[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const scrumDoc = await getDoc(doc(db, "scrums", id));
      if (!scrumDoc.exists()) return;
      const scrum = scrumDoc.data();

      // Fetch card and races in parallel
      const [cardDoc, racesSnap] = await Promise.all([
        getDoc(doc(db, "cards", scrum.cardId)),
        getDocs(query(collection(db, "races"), where("cardId", "==", scrum.cardId))),
      ]);
      setCard(cardDoc.data());
      setShowDetails(scrum.showDetails ?? true);

      async function loadRaces(): Promise<Race[]> {
        // Fetch all races' horses in parallel
        const horseSnaps = await Promise.all(
          racesSnap.docs.map(raceDoc =>
            getDocs(query(collection(db, "horses"), where("raceId", "==", raceDoc.id)))
          )
        );
        const raceList: Race[] = racesSnap.docs.map((raceDoc, i) => {
          const r = raceDoc.data();
          const horses: Horse[] = horseSnaps[i].docs.map(h => ({
            id: h.id,
            number: h.data().number,
            name: h.data().name,
            jockey: h.data().jockey ?? null,
            trainer: h.data().trainer ?? null,
            owner: h.data().owner ?? null,
            form: h.data().form ?? null,
            lbs: h.data().lbs ?? null,
            odds: h.data().odds ?? null,
          })).sort((a, b) => a.number - b.number);
          return {
            id: raceDoc.id,
            raceNumber: r.raceNumber,
            name: r.name ?? null,
            offTime: r.offTime,
            horses,
          };
        });
        const sorted = raceList.sort((a, b) => a.raceNumber - b.raceNumber);
        setRaces(sorted);
        return sorted;
      }

      // Sync runners from TRA if any race has no horses yet, then load
      try { await syncRunners(scrum.cardId); } catch { /* silent */ }
      const loadedRaces = await loadRaces();

      // Jump to the first race that hasn't started yet
      const now = Date.now();
      const firstOpen = loadedRaces.findIndex(r => new Date(r.offTime).getTime() > now);
      if (firstOpen > 0) setCurrentIdx(firstOpen);

      const picksSnap = await getDocs(
        query(collection(db, "picks"),
          where("scrumId", "==", id),
          where("userId", "==", userId))
      );
      const map: Record<string, string> = {};
      picksSnap.docs.forEach(p => { map[p.data().raceId] = p.data().horseId; });
      setPicks(map);
    })();
  }, [id]);

  // Slide direction for animation
  const slideDir = useRef<"forward" | "back">("forward");

  function goNext() { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); }
  function goPrev() { slideDir.current = "back";    setCurrentIdx(i => Math.max(0, i - 1)); }

  // Swipe to navigate between races
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return; // too short, ignore
    if (dx < 0) { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); } // swipe left → next
    else { slideDir.current = "back"; setCurrentIdx(i => Math.max(0, i - 1)); } // swipe right → prev
  }

  const currentRace = races[currentIdx];
  const isLastRace = currentIdx === races.length - 1;

  // A race is locked if its off time has passed
  const raceIsLocked = (r: Race) => new Date(r.offTime).getTime() <= Date.now();

  // Only races that haven't started yet require a pick
  const pickableRaces = races.filter(r => !raceIsLocked(r));
  const allPicked = pickableRaces.length > 0 && pickableRaces.every(r => picks[r.id]);
  const pickedCount = pickableRaces.filter(r => picks[r.id]).length;

  const currentPick = currentRace ? picks[currentRace.id] : undefined;
  const isLocked = currentRace ? raceIsLocked(currentRace) : false;

  // Save pick immediately to Firestore as well as local state
  async function handlePick(raceId: string, horseId: string) {
    if (navigator.vibrate) navigator.vibrate(40);
    setPicks(p => ({ ...p, [raceId]: horseId }));
    try {
      await setDoc(doc(db, "picks", `${id}_${userId}_${raceId}`), {
        scrumId: id, raceId, horseId, userId, points: null,
      });
    } catch {
      // non-blocking — pick is still in local state
    }
  }

  async function handleSubmit() {
    if (!allPicked) { toast.error("Pick a horse in every race"); return; }
    setSubmitting(true);
    try {
      // Batch-write all picks to make sure everything is saved
      const batch = writeBatch(db);
      Object.entries(picks).forEach(([raceId, horseId]) => {
        const pickRef = doc(db, "picks", `${id}_${userId}_${raceId}`);
        batch.set(pickRef, { scrumId: id, raceId, horseId, userId, points: null });
      });
      await batch.commit();
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

  const offTime = currentRace.offTime
    ? new Date(currentRace.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b-brutalist bg-background px-4 sticky top-0 z-50">
        <div className="flex justify-between items-baseline py-2">
          <h1 className="text-[44px] font-black tracking-tighter leading-none">SLIP</h1>
          <div className="text-label-caps">{card?.raceDate ?? ""}</div>
        </div>
        <div className="border-t border-primary/20 pt-1 pb-2 flex justify-between items-center">
          <h2 className="text-[22px] font-black uppercase tracking-tight flex-1 leading-tight">
            {card?.trackName ?? "—"}
          </h2>
          <span className="text-data-mono text-[16px] border-l border-primary/20 pl-2 ml-2">
            {offTime}
          </span>
        </div>

        {/* Race progress dots */}
        {races.length > 0 && (
          <div className="flex gap-1 pb-2 flex-wrap">
            {races.map((r, i) => {
              const locked = raceIsLocked(r);
              return (
                <button
                  key={r.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-5 h-5 flex items-center justify-center text-[9px] font-mono border transition-none
                    ${i === currentIdx
                      ? "bg-primary text-primary-foreground border-primary"
                      : locked
                        ? "bg-muted border-muted-foreground/20 text-muted-foreground/40 line-through"
                        : picks[r.id]
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-background border-primary/20 text-muted-foreground"
                    }`}
                >
                  {r.raceNumber}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main
        className="flex-grow px-4 pt-4 pb-[80px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-between items-end border-b-brutalist mb-3 pb-2">
          <div>
            <span className="text-label-caps text-muted-foreground uppercase">
              Entry {String(currentIdx + 1).padStart(2, "0")} of {String(races.length).padStart(2, "0")}
            </span>
            <h3 className="text-[48px] font-black uppercase leading-none">
              RACE {String(currentRace.raceNumber).padStart(2, "0")}
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

        <div
          key={currentIdx}
          className={`border-brutalist divide-y divide-primary/20 bg-background ${slideDir.current === "forward" ? "animate-slide-forward" : "animate-slide-back"}`}
        >
          {currentRace.horses.length === 0 && (
            /* Skeleton runners while loading */
            <>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-3">
                  <div className="w-8 h-6 bg-muted animate-pulse shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="h-5 w-40 bg-muted animate-pulse mb-2" />
                    <div className="h-3 w-28 bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </>
          )}
          {currentRace.horses.map((h) => {
            const selected = currentPick === h.id;
            return (
              <button
                key={h.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && handlePick(currentRace.id, h.id)}
                className={`w-full flex items-start gap-4 px-4 py-3 text-left relative transition-none
                  ${selected ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}
                  ${isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {selected && (
                  <div className="absolute inset-0 x-stamp opacity-10 pointer-events-none" />
                )}
                <span className="text-headline-md w-8 text-center shrink-0 pt-1">{h.number}</span>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-body-lg uppercase font-bold leading-tight">{h.name}</div>
                  {showDetails && (
                    <>
                      {h.jockey && (
                        <div className="text-label-caps opacity-60 mt-0.5">J: {h.jockey}</div>
                      )}
                      {h.lbs && (
                        <div className="text-label-caps opacity-60">WT: {formatWeight(h.lbs)}</div>
                      )}
                      {h.trainer && (
                        <div className="text-label-caps opacity-60">T: {h.trainer}</div>
                      )}
                      {h.owner && (
                        <div className="text-label-caps opacity-60 truncate">O: {h.owner}</div>
                      )}
                    </>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1 pt-1">
                  {showDetails && h.form && (
                    <span className="text-data-mono text-xs tracking-wider opacity-80">{h.form}</span>
                  )}
                  {selected && (
                    <span className="text-label-caps border border-current px-1 py-0.5">INKED</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full h-[60px] z-50 flex items-center justify-between border-t-brutalist bg-background px-4">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="text-label-caps uppercase disabled:opacity-30 transition-none"
        >
          ← PREV
        </button>
        <div />
        {isLastRace ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !allPicked}
            className="text-label-caps uppercase disabled:opacity-30 transition-none"
          >
            {submitting ? "PRINTING…" : "PRINT →"}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="text-label-caps uppercase transition-none"
          >
            NEXT →
          </button>
        )}
      </div>
    </div>
  );
};

export default Gallop;
