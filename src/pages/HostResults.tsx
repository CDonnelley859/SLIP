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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-label-caps uppercase text-muted-foreground">Loading…</p>
    </div>
  );

  // Only the host can use this page
  if (!scrum || userId !== scrum.hostId) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-label-caps uppercase text-muted-foreground mb-4">Only the group host can enter results.</p>
        <Link to={`/scrum/${id}/lobby`} className="text-label-caps uppercase underline underline-offset-2">
          ← BACK TO LOBBY
        </Link>
      </div>
    </div>
  );

  const settledCount = races.filter(r => r.status === "settled").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-background border-b-brutalist flex items-center justify-between h-16 px-4 sticky top-0 z-50">
        <Link to={`/scrum/${id}/lobby`} className="text-label-caps uppercase">← LOBBY</Link>
        <h1 className="text-headline-md uppercase">RESULTS</h1>
        <span className="text-label-caps uppercase text-muted-foreground">{settledCount}/{races.length}</span>
      </header>

      <main className="px-4 pt-4 max-w-sm mx-auto flex flex-col gap-4">
        <div className="border-brutalist p-3 text-center">
          <p className="text-label-caps text-muted-foreground uppercase">
            {card?.trackName ?? "—"} · HOST ONLY
          </p>
          <p className="text-label-caps text-muted-foreground uppercase opacity-60 mt-1">
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
            <div key={race.id} className={`border-brutalist ${isSettled ? "opacity-60" : ""}`}>
              {/* Race header */}
              <div className="px-4 py-2 border-b border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-label-caps uppercase font-bold">
                    RACE {String(race.raceNumber).padStart(2, "0")}
                    {offTime ? ` · ${offTime}` : ""}
                  </span>
                  {race.name && (
                    <p className="text-label-caps text-muted-foreground uppercase text-[10px] truncate max-w-[200px]">
                      {race.name}
                    </p>
                  )}
                </div>
                {isSettled && (
                  <span className="text-label-caps uppercase text-primary">✓ SETTLED</span>
                )}
              </div>

              {/* Place selectors */}
              {(["first", "second", "third"] as const).map((place, pi) => {
                const label = ["1ST", "2ND", "3RD"][pi];
                const current = p[place];
                return (
                  <div key={place} className={`px-4 py-2 flex items-center gap-3 ${pi < 2 ? "border-b border-primary/20" : ""}`}>
                    <span className="text-label-caps uppercase w-8 shrink-0 font-bold">{label}</span>
                    <select
                      value={current}
                      onChange={e => setPlace(race.id, place, e.target.value)}
                      disabled={isSettled}
                      className="flex-1 bg-background text-body-md uppercase border border-primary/30 px-2 py-1 focus:outline-none disabled:opacity-40"
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
                  className="w-full h-11 bg-primary text-primary-foreground text-label-caps uppercase disabled:opacity-30 transition-none"
                >
                  {isSaving ? "SETTLING…" : "SETTLE RACE"}
                </button>
              )}
            </div>
          );
        })}

        {settledCount === races.length && races.length > 0 && (
          <div className="border-brutalist p-4 text-center">
            <p className="text-headline-md uppercase">ALL DONE</p>
            <p className="text-label-caps text-muted-foreground uppercase mt-1">All races settled</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HostResults;
