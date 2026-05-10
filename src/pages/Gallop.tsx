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

      const [cardDoc, racesSnap] = await Promise.all([
        getDoc(doc(db, "cards", scrum.cardId)),
        getDocs(query(collection(db, "races"), where("cardId", "==", scrum.cardId))),
      ]);
      setCard(cardDoc.data());
      setShowDetails(scrum.showDetails ?? true);

      async function loadRaces(): Promise<Race[]> {
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

      try { await syncRunners(scrum.cardId); } catch { }
      const loadedRaces = await loadRaces();

      const nowTs = Date.now();
      const firstOpen = loadedRaces.findIndex(r => new Date(r.offTime).getTime() > nowTs);
      if (firstOpen > 0) setCurrentIdx(firstOpen);

      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("scrumId", "==", id), where("userId", "==", userId))
      );
      const map: Record<string, string> = {};
      picksSnap.docs.forEach(p => { map[p.data().raceId] = p.data().horseId; });
      setPicks(map);
    })();
  }, [id]);

  const slideDir = useRef<"forward" | "back">("forward");
  function goNext() { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); }
  function goPrev() { slideDir.current = "back";    setCurrentIdx(i => Math.max(0, i - 1)); }

  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); }
    else { slideDir.current = "back"; setCurrentIdx(i => Math.max(0, i - 1)); }
  }

  const currentRace = races[currentIdx];
  const isLastRace = currentIdx === races.length - 1;
  const raceIsLocked = (r: Race) => new Date(r.offTime).getTime() <= Date.now();
  const pickableRaces = races.filter(r => !raceIsLocked(r));
  const allPicked = pickableRaces.length > 0 && pickableRaces.every(r => picks[r.id]);
  const currentPick = currentRace ? picks[currentRace.id] : undefined;
  const isLocked = currentRace ? raceIsLocked(currentRace) : false;

  async function handlePick(raceId: string, horseId: string) {
    if (navigator.vibrate) navigator.vibrate(40);
    setPicks(p => ({ ...p, [raceId]: horseId }));
    try {
      await setDoc(doc(db, "picks", `${id}_${userId}_${raceId}`), {
        scrumId: id, raceId, horseId, userId, points: null,
      });
    } catch { }
  }

  async function handleSubmit() {
    if (!allPicked) { toast.error("Pick a horse in every race"); return; }
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      Object.entries(picks).forEach(([raceId, horseId]) => {
        batch.set(doc(db, "picks", `${id}_${userId}_${raceId}`), {
          scrumId: id, raceId, horseId, userId, points: null,
        });
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          Loading card…
        </p>
      </div>
    );
  }

  const offTime = currentRace.offTime
    ? new Date(currentRace.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "var(--cream)", borderBottom: "3px solid var(--ink)" }}
      >
        <div style={{ padding: "14px 18px 8px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span className="font-display" style={{ fontSize: 44, lineHeight: 0.9, color: "var(--ink)" }}>SLIP</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-soft)" }}>
            {card?.raceDate ?? ""}
          </span>
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(26,20,16,0.15)",
            padding: "6px 18px 8px",
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
          }}
        >
          <span className="font-display" style={{ fontSize: 22, color: "var(--ink)" }}>
            {card?.trackName ?? "—"}
          </span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            {offTime}
          </span>
        </div>

        {/* race number tabs */}
        {races.length > 0 && (
          <div style={{ padding: "0 18px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {races.map((r, i) => {
              const locked = raceIsLocked(r);
              const active = i === currentIdx;
              const picked = picks[r.id];
              return (
                <button
                  key={r.id}
                  onClick={() => setCurrentIdx(i)}
                  style={{
                    width: 34, height: 34,
                    border: "2.5px solid var(--ink)",
                    background: active ? "var(--ink)" : locked ? "transparent" : picked ? "rgba(26,20,16,0.12)" : "var(--cream)",
                    color: active ? "var(--cream)" : locked ? "rgba(26,20,16,0.3)" : "var(--ink)",
                    fontFamily: "Bagel Fat One, system-ui, sans-serif",
                    fontSize: 15, cursor: "pointer",
                    textDecoration: locked ? "line-through" : "none",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {r.raceNumber}
                </button>
              );
            })}
            <span
              style={{
                alignSelf: "center", marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10, letterSpacing: "0.14em", opacity: 0.55,
              }}
            >
              ENTRY {String(currentIdx + 1).padStart(2, "0")}/{String(races.length).padStart(2, "0")}
            </span>
          </div>
        )}
      </header>

      {/* ── RACE TITLE ── */}
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: "3px solid var(--ink)",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}
      >
        <div>
          <div
            className="font-display"
            style={{ fontSize: 64, lineHeight: 0.85, color: "var(--retro-pink)", textShadow: "3px 3px 0 var(--ink)" }}
          >
            R
          </div>
          <div
            className="font-display"
            style={{ fontSize: 64, lineHeight: 0.85, color: "var(--retro-pink)", textShadow: "3px 3px 0 var(--ink)", marginTop: -8 }}
          >
            {String(currentRace.raceNumber).padStart(2, "0")}
          </div>
        </div>
        <div style={{ flex: 1, paddingTop: 6 }}>
          {currentRace.name && (
            <div className="font-display" style={{ fontSize: 18, lineHeight: 1.1, color: "var(--ink)" }}>
              {currentRace.name}
            </div>
          )}
          {isLocked && (
            <span
              style={{
                display: "inline-block", marginTop: 8,
                border: "2px solid var(--retro-pink)", color: "var(--retro-pink)",
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "3px 8px",
              }}
            >
              LOCKED
            </span>
          )}
        </div>
      </div>

      {/* ── HORSE LIST ── */}
      <main
        className="flex-grow"
        style={{ paddingBottom: 80 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={currentIdx}
          style={{ borderBottom: "3px solid var(--ink)" }}
          className={slideDir.current === "forward" ? "animate-slide-forward" : "animate-slide-back"}
        >
          {currentRace.horses.length === 0 && (
            [...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex", gap: 14, padding: "12px 18px",
                  borderBottom: "1px solid rgba(26,20,16,0.12)",
                }}
              >
                <div style={{ width: 30, height: 20, background: "var(--cream-2)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 18, width: 160, background: "var(--cream-2)", marginBottom: 6 }} />
                  <div style={{ height: 10, width: 110, background: "var(--cream-2)" }} />
                </div>
              </div>
            ))
          )}
          {currentRace.horses.map((h) => {
            const selected = currentPick === h.id;
            return (
              <button
                key={h.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && handlePick(currentRace.id, h.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "12px 18px", textAlign: "left",
                  border: 0, borderBottom: "1px solid rgba(26,20,16,0.12)",
                  background: selected ? "var(--ink)" : "var(--cream)",
                  color: selected ? "var(--cream)" : "var(--ink)",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.6 : 1,
                  position: "relative",
                  boxShadow: selected ? "inset 0 0 0 0" : "none",
                  transition: "background 80ms",
                }}
              >
                {selected && (
                  <div className="x-stamp" style={{ position: "absolute", inset: 0, opacity: 0.08, pointerEvents: "none", color: "var(--cream)" }} />
                )}
                <span
                  className="font-display"
                  style={{ fontSize: 32, lineHeight: 0.9, minWidth: 38, paddingTop: 2 }}
                >
                  {h.number}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-display" style={{ fontSize: 18, lineHeight: 1 }}>{h.name}</div>
                  {showDetails && (
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, marginTop: 5, lineHeight: 1.5, opacity: 0.7 }}>
                      {h.jockey && <div>J: {h.jockey}</div>}
                      {h.lbs && <div>WT: {formatWeight(h.lbs)}</div>}
                      {h.trainer && <div>T: {h.trainer}</div>}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingTop: 2 }}>
                  {showDetails && h.form && (
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, opacity: 0.7, letterSpacing: "0.1em" }}>
                      {h.form}
                    </span>
                  )}
                  {selected && (
                    <span
                      style={{
                        border: "2px solid currentColor", padding: "2px 6px",
                        fontFamily: "Bagel Fat One, system-ui, sans-serif",
                        fontSize: 12, letterSpacing: "0.06em",
                        color: "var(--retro-pink)",
                      }}
                    >
                      INKED
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* ── FOOTER NAV ── */}
      <div
        className="fixed bottom-0 left-0 w-full z-50"
        style={{
          borderTop: "3px solid var(--ink)", background: "var(--cream)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px", height: 60,
        }}
      >
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "Bagel Fat One, system-ui, sans-serif",
            fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--ink)", opacity: currentIdx === 0 ? 0.25 : 1,
          }}
        >
          ← PREV
        </button>

        {isLastRace ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !allPicked}
            style={{
              border: "2.5px solid var(--ink)",
              background: "var(--retro-green)", color: "var(--cream)",
              fontFamily: "Bagel Fat One, system-ui, sans-serif",
              fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "10px 18px", cursor: "pointer",
              boxShadow: "3px 3px 0 var(--ink)",
              opacity: (submitting || !allPicked) ? 0.35 : 1,
            }}
          >
            {submitting ? "PRINTING…" : "PRINT SLIP →"}
          </button>
        ) : (
          <button
            onClick={goNext}
            style={{
              background: "transparent", border: 0, cursor: "pointer",
              fontFamily: "Bagel Fat One, system-ui, sans-serif",
              fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            NEXT →
          </button>
        )}
      </div>
    </div>
  );
};

export default Gallop;
