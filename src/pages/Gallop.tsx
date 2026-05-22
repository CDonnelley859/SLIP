import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncRunners } from "@/lib/racingApi";
import { seedVirtualTrack } from "@/lib/virtualTrack";
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, writeBatch,
} from "firebase/firestore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Horse = { id: string; number: number; name: string; jockey: string | null; trainer: string | null; owner: string | null; form: string | null; lbs: number | null; odds: string | null };

function formatWeight(lbs: number): string {
  const st = Math.floor(lbs / 14);
  const lb = lbs % 14;
  return `${st}-${lb}`;
}
type Race = { id: string; raceNumber: number; name: string | null; offTime: string; status: string; horses: Horse[] };

const Gallop = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [card, setCard] = useState<any>(null);
  const [megaSlipId, setMegaSlipId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [races, setRaces] = useState<Race[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Live clock so isLocked updates in real time as races start
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
      const scrumDoc = await getDoc(doc(db, "scrums", id));
      if (!scrumDoc.exists()) { setLoadError("Group not found."); return; }
      const scrum = scrumDoc.data();
      setMegaSlipId(scrum.megaSlipId ?? null);

      let [cardDoc, racesSnap] = await Promise.all([
        getDoc(doc(db, "cards", scrum.cardId)),
        getDocs(query(collection(db, "races"), where("cardId", "==", scrum.cardId))),
      ]);
      setCard(cardDoc.data());
      setShowDetails(scrum.showDetails ?? false);

      // Detect virtual cards by ID prefix — don't rely on the card doc existing yet
      const isVirtual = scrum.cardId?.startsWith("blotto-park-") || cardDoc.data()?.isVirtual;
      if (isVirtual && (!cardDoc.exists() || racesSnap.empty)) {
        try { await seedVirtualTrack(); } catch { }
        let [freshCard, freshRaces] = await Promise.all([
          getDoc(doc(db, "cards", scrum.cardId)),
          getDocs(query(collection(db, "races"), where("cardId", "==", scrum.cardId))),
        ]);
        cardDoc = freshCard;
        racesSnap = freshRaces;
        setCard(cardDoc.data());
      }

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
            status: r.status ?? "upcoming",
            horses,
          };
        });
        const sorted = raceList.sort((a, b) => a.raceNumber - b.raceNumber);
        setRaces(sorted);
        return sorted;
      }

      // Skip live sync for the virtual test track
      if (!cardDoc.data()?.isVirtual) {
        try { await syncRunners(scrum.cardId); } catch { }
      }
      const loadedRaces = await loadRaces();

      const nowTs = Date.now();
      const firstOpen = loadedRaces.findIndex(r => new Date(r.offTime).getTime() > nowTs);
      if (firstOpen > 0) setCurrentIdx(firstOpen);

      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("scrumId", "==", id), where("userId", "==", userId))
      );
      const map: Record<string, string> = {};
      picksSnap.docs.forEach(p => { map[p.data().raceId] = p.data().horseId; });

      // Auto-pick races that have started but not yet finished (status !== "settled").
      // A settled race is already done — assigning a random pick after the fact isn't fair.
      const nowTs2 = Date.now();
      const missedRaces = loadedRaces.filter(
        r => new Date(r.offTime).getTime() <= nowTs2
          && r.status !== "settled"
          && !map[r.id]
          && r.horses.length > 0
      );
      if (missedRaces.length > 0) {
        const autoBatch = writeBatch(db);
        missedRaces.forEach(r => {
          const horse = r.horses[Math.floor(Math.random() * r.horses.length)];
          map[r.id] = horse.id;
          autoBatch.set(doc(db, "picks", `${id}_${userId}_${r.id}`), {
            scrumId: id, raceId: r.id, horseId: horse.id, userId,
            points: null, horseName: horse.name, raceNumber: r.raceNumber,
            autoPicked: true,
          });
        });
        await autoBatch.commit();
        toast(`${missedRaces.length} race${missedRaces.length > 1 ? "s" : ""} auto-picked for you`, { icon: "🎲" });
      }

      setPicks(map);
      } catch (err: any) {
        setLoadError(err?.message ?? "Something went wrong loading the card.");
      }
    })();
  }, [id]);

  const slideDir = useRef<"forward" | "back">("forward");
  function goNext() { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); }
  function goPrev() { slideDir.current = "back";    setCurrentIdx(i => Math.max(0, i - 1)); }

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Attach a non-passive touchmove so we can preventDefault on horizontal swipes,
  // stopping the page from wobbling while the user swipes between races.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > dy) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) { slideDir.current = "forward"; setCurrentIdx(i => Math.min(races.length - 1, i + 1)); }
    else { slideDir.current = "back"; setCurrentIdx(i => Math.max(0, i - 1)); }
  }

  const currentRace = races[currentIdx];
  const isLastRace = currentIdx === races.length - 1;
  const raceIsLocked = (r: Race) => new Date(r.offTime).getTime() <= now;
  const pickableRaces = races.filter(r => !raceIsLocked(r));
  const allPicked = pickableRaces.length > 0 && pickableRaces.every(r => picks[r.id]);
  const currentPick = currentRace ? picks[currentRace.id] : undefined;
  const isLocked = currentRace ? raceIsLocked(currentRace) : false;

  function jumpToNextOpen() {
    // Find the next open race after currentIdx, wrapping to any open race if none after
    const after = races.findIndex((r, i) => i > currentIdx && !raceIsLocked(r));
    if (after !== -1) { setCurrentIdx(after); return; }
    const any = races.findIndex(r => !raceIsLocked(r));
    if (any !== -1) setCurrentIdx(any);
  }

  async function handlePick(raceId: string, horseId: string, horseName: string, raceNumber: number) {
    if (navigator.vibrate) navigator.vibrate(40);
    setPicks(p => ({ ...p, [raceId]: horseId }));
    try {
      await setDoc(doc(db, "picks", `${id}_${userId}_${raceId}`), {
        scrumId: id, raceId, horseId, userId, points: null,
        horseName, raceNumber,
      });
    } catch { }
  }

  async function handleSubmit() {
    if (!allPicked) { toast.error("Pick a horse in every race"); return; }
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      // Build a quick lookup so we can embed horseName + raceNumber in each pick
      const raceMap = Object.fromEntries(races.map(r => [r.id, r]));
      Object.entries(picks).forEach(([raceId, horseId]) => {
        const race = raceMap[raceId];
        const horse = race?.horses.find(h => h.id === horseId);
        batch.set(doc(db, "picks", `${id}_${userId}_${raceId}`), {
          scrumId: id, raceId, horseId, userId, points: null,
          horseName: horse?.name ?? null,
          raceNumber: race?.raceNumber ?? null,
        });
      });
      await batch.commit();
      if (megaSlipId) {
        navigate(`/mega/${megaSlipId}/hub`);
      } else {
        navigate(`/scrum/${id}/slip`, { state: { printOnLoad: true } });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentRace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--green)" }}>
        {loadError ? (
          <>
            <p className="label" style={{ color: "var(--cream)", opacity: 0.8 }}>{loadError}</p>
            <button
              className="label"
              onClick={() => navigate(-1)}
              style={{ color: "var(--cream)", opacity: 0.5, background: "transparent", border: 0, cursor: "pointer" }}
            >
              ← Go back
            </button>
          </>
        ) : (
          <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Loading card…</p>
        )}
      </div>
    );
  }

  const offTime = currentRace.offTime
    ? new Date(currentRace.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen flex flex-col halftone-bg" style={{ background: "var(--green)", touchAction: "pan-y" }}>

      {/* ── HEADER ── */}
      <header
        style={{
          background: "var(--green)",
          borderBottom: "3px solid rgba(245,232,223,0.25)",
          padding: "16px 18px 10px",
        }}
      >
        {/* top row */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <button
            onClick={() => megaSlipId ? navigate(`/mega/${megaSlipId}/hub`) : navigate(`/scrum/${id}/lobby`)}
            className="label"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)" }}
          >
            {megaSlipId ? "← HUB" : "← PEN"}
          </button>
          <span className="display" style={{ fontSize: 36, lineHeight: 0.9, color: "var(--cream)" }}>
            {card?.trackName ?? "—"}
          </span>
          <span className="label" style={{ fontSize: 10, color: "var(--cream)", opacity: 0.7 }}>
            {offTime}
          </span>
        </div>

        {/* race selector row */}
        {races.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {races.map((r, i) => {
              const locked = raceIsLocked(r);
              const active = i === currentIdx;
              return (
                <button
                  key={r.id}
                  onClick={() => setCurrentIdx(i)}
                  className="display"
                  style={{
                    width: 36, height: 36,
                    border: active ? "2.5px solid var(--cream)" : "2.5px solid rgba(245,232,223,0.35)",
                    background: active ? "var(--cream)" : "var(--green)",
                    color: active ? "var(--ink)" : "var(--cream)",
                    fontSize: 16, cursor: "pointer",
                    textDecoration: locked ? "line-through" : "none",
                    opacity: locked ? 0.45 : 1,
                  }}
                >
                  {r.raceNumber}
                </button>
              );
            })}
            <span
              className="label-sm"
              style={{ marginLeft: "auto", opacity: 0.6, color: "var(--cream)" }}
            >
              ENTRY {String(currentIdx + 1).padStart(2, "0")}/{String(races.length).padStart(2, "0")}
            </span>
          </div>
        )}
      </header>

      {/* ── RACE TITLE ── */}
      <div style={{ padding: "16px 18px 10px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div className="display" style={{ fontSize: 64, lineHeight: 0.85, color: "var(--cream)", textShadow: "3px 3px 0 rgba(245,232,223,0.2)" }}>
            R{String(currentRace.raceNumber).padStart(2, "0")}
          </div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            {currentRace.name && (
              <div className="display" style={{ fontSize: 18, lineHeight: 1, color: "var(--cream)", textWrap: "balance" as any }}>
                {currentRace.name}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="label-sm" style={{ background: "rgba(245,232,223,0.2)", color: "var(--cream)", padding: "3px 6px", border: "1px solid rgba(245,232,223,0.35)" }}>
                {card?.raceDate ?? ""}
              </span>
              {isLocked && (
                <span className="label-sm" style={{ background: "var(--pink)", color: "var(--cream)", padding: "3px 6px" }}>
                  LOCKED
                </span>
              )}
              <span className="label-sm" style={{ background: "var(--ink)", color: "var(--cream)", padding: "3px 6px" }}>
                {offTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* perf divider */}
      <div className="perf" style={{ margin: "0 18px" }} />

      {/* ── HORSE LIST ── */}
      <main
        ref={mainRef}
        className="flex-grow"
        style={{ padding: "10px 18px 24px" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={currentIdx}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
          className={slideDir.current === "forward" ? "animate-slide-forward" : "animate-slide-back"}
        >
          {/* Banner when this race has already started */}
          {isLocked && (
            <div style={{
              border: "2px dashed rgba(245,232,223,0.35)",
              padding: "14px 18px",
              marginBottom: 16,
              textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div className="display" style={{ fontSize: 16, color: "var(--cream)" }}>RACE STARTED</div>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 2 }}>
                  Picking is closed.
                </div>
              </div>
              {pickableRaces.length > 0 && (
                <button
                  onClick={jumpToNextOpen}
                  className="label"
                  style={{
                    background: "var(--cream)", color: "var(--ink)",
                    border: 0, padding: "8px 14px", cursor: "pointer",
                    fontSize: 11, letterSpacing: "0.1em", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  NEXT OPEN →
                </button>
              )}
            </div>
          )}

          {currentRace.horses.length === 0 && !isLocked && (
            [...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex", gap: 14, padding: "12px 0",
                  borderBottom: "1px solid rgba(245,232,223,0.12)",
                }}
              >
                <div style={{ width: 30, height: 20, background: "rgba(245,232,223,0.15)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 18, width: 160, background: "rgba(245,232,223,0.15)", marginBottom: 6 }} />
                  <div style={{ height: 10, width: 110, background: "rgba(245,232,223,0.15)" }} />
                </div>
              </div>
            ))
          )}
          {currentRace.horses.map((h) => {
            const selected = currentPick === h.id;
            return (
              <motion.button
                key={h.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && handlePick(currentRace.id, h.id, h.name, currentRace.raceNumber)}
                whileTap={isLocked ? {} : { scale: 0.97 }}
                animate={{
                  background: selected ? "var(--cream)" : "var(--green)",
                  boxShadow: selected ? "5px 5px 0 var(--pink)" : "0px 0px 0 var(--pink)",
                }}
                transition={{ duration: 0.12 }}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px", textAlign: "left", marginBottom: 10,
                  border: selected ? "3px solid var(--cream)" : "2px solid rgba(245,232,223,0.25)",
                  color: selected ? "var(--ink)" : "var(--cream)",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <span className="display" style={{ fontSize: 30, lineHeight: 0.9, minWidth: 36 }}>
                  {h.number}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="display" style={{ fontSize: 18 }}>{h.name}</div>
                  {showDetails && (
                    <div className="mono" style={{ fontSize: 10, marginTop: 5, lineHeight: 1.5, opacity: 0.75 }}>
                      {h.jockey && <div>J: {h.jockey}</div>}
                      {h.lbs && <div>WT: {formatWeight(h.lbs)}</div>}
                      {h.trainer && <div>T: {h.trainer}</div>}
                      {h.odds && <div>O: {h.odds}</div>}
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {selected && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, rotate: -14 }}
                      animate={{ scale: 1, opacity: 1, rotate: -6 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      style={{ flexShrink: 0, paddingTop: 2 }}
                    >
                      <span className="display" style={{
                        display: "inline-block", border: "2px solid var(--pink)",
                        color: "var(--pink)", padding: "2px 6px",
                        fontSize: 12, letterSpacing: "0.06em", background: "transparent",
                      }}>
                        INKED
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </main>

      {/* ── STICKY FOOTER ── */}
      <div
        style={{
          position: "sticky", bottom: 0,
          padding: "12px 18px",
          borderTop: "3px solid rgba(245,232,223,0.25)",
          background: "var(--green)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="label"
          style={{
            background: "transparent", border: 0, cursor: "pointer",
            color: "var(--cream)", opacity: currentIdx === 0 ? 0.25 : 1,
          }}
        >
          ← PREV
        </button>

        {isLastRace ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !allPicked}
            className="btn-retro btn-retro-pink"
            style={{
              width: "auto", padding: "10px 18px", fontSize: 14,
              opacity: (submitting || !allPicked) ? 0.35 : 1,
            }}
          >
            {submitting ? "PRINTING…" : "PRINT SLIP →"}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="label"
            style={{
              background: "transparent", border: 0, cursor: "pointer",
              color: "var(--cream)",
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
