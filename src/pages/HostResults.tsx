import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, writeBatch,
} from "firebase/firestore";
import { toast } from "sonner";

type Horse = { id: string; number: number; name: string };
type RaceEntry = {
  id: string;
  raceNumber: number;
  name: string | null;
  offTime: string | null;
  status: string;
  winners: { first: string | null; second: string | null; third: string | null };
  horses: Horse[];
};

const HostResults = () => {
  const { id } = useParams(); // scrum id
  const { userId } = useAuth();

  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [races, setRaces] = useState<RaceEntry[]>([]);
  const [picks, setPicks] = useState<Record<string, { first: string; second: string; third: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const scrumDoc = await getDoc(doc(db, "scrums", id));
      if (!scrumDoc.exists()) return;
      const scrumData = scrumDoc.data();
      setScrum(scrumData);

      const cardDoc = await getDoc(doc(db, "cards", scrumData.cardId));
      setCard(cardDoc.data());

      const racesSnap = await getDocs(
        query(collection(db, "races"), where("cardId", "==", scrumData.cardId))
      );

      const raceEntries: RaceEntry[] = [];
      const initialPicks: Record<string, { first: string; second: string; third: string }> = {};

      for (const raceDoc of racesSnap.docs) {
        const race = raceDoc.data();
        const horsesSnap = await getDocs(
          query(collection(db, "horses"), where("raceId", "==", raceDoc.id))
        );
        const horses: Horse[] = horsesSnap.docs
          .map(h => ({ id: h.id, number: h.data().number, name: h.data().name }))
          .sort((a, b) => a.number - b.number);

        raceEntries.push({
          id: raceDoc.id,
          raceNumber: race.raceNumber ?? 0,
          name: race.name ?? null,
          offTime: race.offTime ?? null,
          status: race.status ?? "upcoming",
          winners: {
            first: race.winners?.first ?? null,
            second: race.winners?.second ?? null,
            third: race.winners?.third ?? null,
          },
          horses,
        });

        // Pre-fill from existing winners
        initialPicks[raceDoc.id] = {
          first: race.winners?.first ?? "",
          second: race.winners?.second ?? "",
          third: race.winners?.third ?? "",
        };
      }

      raceEntries.sort((a, b) => a.raceNumber - b.raceNumber);
      setRaces(raceEntries);
      setPicks(initialPicks);
      setLoading(false);
    })();
  }, [id]);

  async function handleSettle(raceId: string) {
    const p = picks[raceId];
    if (!p?.first || !p?.second || !p?.third) return;
    if (p.first === p.second || p.first === p.third || p.second === p.third) {
      toast.error("Each place must be a different horse");
      return;
    }

    setSaving(s => ({ ...s, [raceId]: true }));
    try {
      const winners = { first: p.first, second: p.second, third: p.third };

      // Update race status and winners
      await updateDoc(doc(db, "races", raceId), { status: "settled", winners });

      // Score all picks for this race
      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("raceId", "==", raceId))
      );
      const batch = writeBatch(db);
      for (const pickDoc of picksSnap.docs) {
        const horseId = pickDoc.data().horseId;
        let points = 0;
        if (horseId === winners.first) points = 5;
        else if (horseId === winners.second) points = 3;
        else if (horseId === winners.third) points = 1;
        batch.update(pickDoc.ref, { points });
      }
      await batch.commit();

      // Update local state
      setRaces(prev => prev.map(r =>
        r.id === raceId ? { ...r, status: "settled", winners } : r
      ));
      toast.success(`Race ${races.find(r => r.id === raceId)?.raceNumber} settled`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to settle race");
    } finally {
      setSaving(s => ({ ...s, [raceId]: false }));
    }
  }

  function setPlace(raceId: string, place: "first" | "second" | "third", horseId: string) {
    setPicks(prev => ({ ...prev, [raceId]: { ...prev[raceId], [place]: horseId } }));
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--green)" }}>
      <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Loading…</p>
    </div>
  );

  // Only the host can use this page
  if (!scrum || userId !== scrum.hostId) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--green)" }}>
      <div style={{ textAlign: "center" }}>
        <p className="label" style={{ color: "var(--cream)", opacity: 0.7, marginBottom: 16 }}>Only the group host can enter results.</p>
        <Link to={`/scrum/${id}/lobby`} className="label" style={{ color: "var(--cream)", textDecoration: "underline" }}>
          ← BACK TO LOBBY
        </Link>
      </div>
    </div>
  );

  const settledCount = races.filter(r => r.status === "settled").length;

  return (
    <div className="min-h-screen pb-20" style={{ background: "var(--green)" }}>
      <header
        style={{
          background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 64, padding: "0 18px", position: "sticky", top: 0, zIndex: 50,
        }}
      >
        <Link to={`/scrum/${id}/lobby`} className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← LOBBY</Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>RESULTS</span>
        <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.6 }}>{settledCount}/{races.length}</span>
      </header>

      <main style={{ padding: "16px 18px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 12, textAlign: "center" }}>
          <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.8 }}>
            {card?.trackName ?? "—"} · HOST ONLY
          </p>
          <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 4 }}>
            Pick 1st, 2nd &amp; 3rd for each race, then tap SETTLE
          </p>
        </div>

        {races.map((race) => {
          const p = picks[race.id] ?? { first: "", second: "", third: "" };
          const isSettled = race.status === "settled";
          const isSaving = saving[race.id] ?? false;
          const canSettle = p.first && p.second && p.third
            && p.first !== p.second && p.first !== p.third && p.second !== p.third;

          const offTime = race.offTime
            ? new Date(race.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;

          return (
            <div key={race.id} style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", opacity: isSettled ? 0.6 : 1 }}>
              {/* Race header */}
              <div style={{ padding: "10px 16px", borderBottom: "1.5px solid rgba(245,232,223,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span className="label" style={{ color: "var(--cream)" }}>
                    RACE {String(race.raceNumber).padStart(2, "0")}
                    {offTime ? ` · ${offTime}` : ""}
                  </span>
                  {race.name && (
                    <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 2 }}>
                      {race.name}
                    </p>
                  )}
                </div>
                {isSettled && (
                  <span className="label-sm" style={{ color: "var(--pink)" }}>✓ SETTLED</span>
                )}
              </div>

              {/* Place selectors */}
              {(["first", "second", "third"] as const).map((place, pi) => {
                const placeLabel = ["1ST", "2ND", "3RD"][pi];
                const current = p[place];
                return (
                  <div key={place} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: pi < 2 ? "1.5px solid rgba(245,232,223,0.15)" : undefined }}>
                    <span className="label-sm" style={{ color: "var(--cream)", width: 32, flexShrink: 0 }}>{placeLabel}</span>
                    <select
                      value={current}
                      onChange={e => setPlace(race.id, place, e.target.value)}
                      disabled={isSettled}
                      className="mono"
                      style={{ flex: 1, background: "var(--green)", color: "var(--cream)", border: "1.5px solid rgba(245,232,223,0.3)", padding: "6px 8px", fontSize: 12, textTransform: "uppercase", outline: "none", opacity: isSettled ? 0.4 : 1 }}
                    >
                      <option value="">— PICK HORSE —</option>
                      {race.horses.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.number}. {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}

              {/* Settle button */}
              {!isSettled && (
                <button
                  onClick={() => handleSettle(race.id)}
                  disabled={!canSettle || isSaving}
                  className="display"
                  style={{
                    width: "100%", padding: "14px", fontSize: 16, letterSpacing: "0.06em",
                    textTransform: "uppercase", border: 0, cursor: canSettle ? "pointer" : "not-allowed",
                    background: canSettle ? "var(--cream)" : "rgba(245,232,223,0.15)",
                    color: canSettle ? "var(--ink)" : "rgba(245,232,223,0.4)",
                    opacity: isSaving ? 0.5 : 1,
                  }}
                >
                  {isSaving ? "SETTLING…" : "SETTLE RACE"}
                </button>
              )}
            </div>
          );
        })}

        {settledCount === races.length && races.length > 0 && (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", padding: 16, textAlign: "center" }}>
            <p className="display" style={{ fontSize: 24, color: "var(--cream)" }}>ALL DONE</p>
            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 4 }}>ALL RACES SETTLED</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HostResults;
