import { db } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDocs, query, where, updateDoc, writeBatch,
} from "firebase/firestore";

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`Racing API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function syncCards(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/racecards?date=${today}`);

  // RapidAPI returns races grouped by course
  const courses: Record<string, any[]> = data.courses ?? {};
  let count = 0;

  for (const [trackName, races] of Object.entries(courses)) {
    if (!Array.isArray(races) || races.length === 0) continue;

    const courseSlug = trackName.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseSlug}`;

    // Race time field varies by API — try all common names
    const firstRace = races[0] ?? {};
    const firstRaceTime = firstRace.time ?? firstRace.race_time ?? firstRace.off ?? firstRace.off_time ?? "12:00";

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
      const raceTime = race.time ?? race.race_time ?? race.off ?? race.off_time ?? "12:00";
      const offTime = `${today}T${raceTime}:00Z`;

      await setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: race.title ?? race.race_name ?? race.name ?? null,
        offTime,
        status: "upcoming",
        winners: null,
        sourceId: race.id ?? raceId,
      }, { merge: true });

      // Runners are nested inside each race object
      const raceRunners: any[] = race.runners ?? race.horses ?? race.entries ?? [];
      if (raceRunners.length > 0) {
        const batch = writeBatch(db);
        raceRunners.forEach((runner, idx) => {
          const horseId = `${raceId}-h${idx + 1}`;
          batch.set(doc(db, "horses", horseId), {
            raceId,
            number: runner.number ?? runner.saddle_number ?? runner.cloth ?? idx + 1,
            name: runner.horse ?? runner.name ?? runner.horse_name ?? "Unknown",
            jockey: runner.jockey ?? runner.jockey_name ?? null,
            odds: runner.odds ?? runner.sp ?? null,
          }, { merge: true });
        });
        await batch.commit();
      }

      count++;
    }
  }

  return count;
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
