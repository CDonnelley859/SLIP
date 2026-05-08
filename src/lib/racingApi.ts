import { db } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDocs, query, where, updateDoc, writeBatch,
} from "firebase/firestore";

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`Racing API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Syncs card + race metadata only (fast — 1 API call)
export async function syncCards(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/racecards?date=${today}`);

  const courses: Record<string, any[]> = data.courses ?? {};
  let raceCount = 0;

  for (const [trackName, races] of Object.entries(courses)) {
    if (!Array.isArray(races) || races.length === 0) continue;

    const courseSlug = trackName.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseSlug}`;
    const firstRaceTime = (races[0]?.date ?? "").split(" ")[1]?.slice(0, 5) ?? "12:00";

    await setDoc(doc(db, "cards", cardId), {
      trackName,
      raceDate: today,
      postTime: `${today}T${firstRaceTime}:00Z`,
      status: "upcoming",
      sourceId: cardId,
      raceCount: races.length,
    }, { merge: true });

    for (let i = 0; i < races.length; i++) {
      const race = races[i];
      const raceNum = i + 1;
      const raceId = `${cardId}-r${raceNum}`;
      const raceTime = (race.date ?? "").split(" ")[1]?.slice(0, 5) ?? "12:00";

      await setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: race.title ?? null,
        offTime: `${today}T${raceTime}:00Z`,
        status: "upcoming",
        winners: null,
        sourceId: race.id_race ?? raceId,
      }, { merge: true });

      raceCount++;
    }
  }

  return `${raceCount} races loaded`;
}

// Syncs runners for a specific card — called when Gallop page opens
export async function syncRunners(cardId: string): Promise<number> {
  // Get all races for this card
  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );
  if (racesSnap.empty) return 0;

  // Only fetch races that don't already have horses in Firestore
  const racesNeedingRunners: typeof racesSnap.docs = [];
  for (const raceDoc of racesSnap.docs) {
    const existingHorses = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceDoc.id))
    );
    if (existingHorses.empty) racesNeedingRunners.push(raceDoc);
  }

  if (racesNeedingRunners.length === 0) return 0; // Already have all horses

  // Collect the RapidAPI race IDs for races that need runners
  const raceIds = racesNeedingRunners
    .map(d => d.data().sourceId)
    .filter(Boolean)
    .join(",");

  const data = await apiFetch(`/runners?ids=${raceIds}`);
  const byId: Record<string, any> = data ?? {};

  let horseCount = 0;

  for (const raceDoc of racesNeedingRunners) {
    const sourceId = raceDoc.data().sourceId;
    const detail = byId[sourceId];
    if (!detail) continue;

    const raceRunners: any[] = (detail.horses ?? []).filter((h: any) => h.non_runner !== "1");
    if (raceRunners.length === 0) continue;

    const batch = writeBatch(db);
    raceRunners.forEach((runner, idx) => {
      const horseId = `${raceDoc.id}-h${idx + 1}`;
      const bestOdds = Array.isArray(runner.odds) && runner.odds.length > 0
        ? runner.odds[0].odd
        : (runner.sp || null);
      batch.set(doc(db, "horses", horseId), {
        raceId: raceDoc.id,
        number: Number(runner.number) || idx + 1,
        name: runner.horse ?? "Unknown",
        jockey: runner.jockey ?? null,
        odds: bestOdds,
        sourceId: runner.id_horse ?? null,
      }, { merge: true });
      horseCount++;
    });
    await batch.commit();
  }

  return horseCount;
}

export async function syncResults(cardId: string): Promise<void> {
  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled" || !race.sourceId) continue;

    try {
      const data = await apiFetch(`/results?raceId=${race.sourceId}`);
      const result = data.result ?? data;
      const runners: any[] = result.runners ?? [];

      const getAt = (pos: number) => runners.find((r: any) => Number(r.position) === pos);
      const first = getAt(1);
      const second = getAt(2);
      const third = getAt(3);
      if (!first) continue;

      const winners = {
        first: first.horse_id ?? null,
        second: second?.horse_id ?? null,
        third: third?.horse_id ?? null,
      };

      await updateDoc(raceDoc.ref, { status: "settled", winners });

      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("raceId", "==", raceDoc.id))
      );
      for (const pickDoc of picksSnap.docs) {
        const pick = pickDoc.data();
        let points = 0;
        if (pick.horseId === winners.first) points = 5;
        else if (pick.horseId === winners.second) points = 3;
        else if (pick.horseId === winners.third) points = 1;
        await updateDoc(pickDoc.ref, { points });
      }
    } catch {
      // result not yet available
    }
  }
}
