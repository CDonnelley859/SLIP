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

  const courses: Record<string, any[]> = data.courses ?? {};
  const runners: Record<string, any> = data.runners ?? {};
  let count = 0;

  for (const [trackName, races] of Object.entries(courses)) {
    if (!Array.isArray(races) || races.length === 0) continue;

    const courseSlug = trackName.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseSlug}`;
    const firstRaceTime = races[0]?.race_time ?? "12:00";

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
      const offTime = `${today}T${race.race_time ?? "12:00"}:00Z`;

      await setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: race.race_name ?? null,
        offTime,
        status: "upcoming",
        winners: null,
        sourceId: raceId,
      }, { merge: true });

      // OurHub runner-info keys are "TrackName HH:MM" format
      const raceKey = `${trackName} ${race.race_time}`;
      const raceRunners: any[] = Array.isArray(runners[raceKey]) ? runners[raceKey] : [];
      const batch = writeBatch(db);
      raceRunners.forEach((runner, idx) => {
        const horseId = `${raceId}-h${idx + 1}`;
        batch.set(doc(db, "horses", horseId), {
          raceId,
          number: runner.saddle_number ?? runner.number ?? idx + 1,
          name: runner.horse ?? runner.name ?? "Unknown",
          jockey: runner.jockey ?? null,
          odds: runner.odds ?? null,
        }, { merge: true });
      });
      if (raceRunners.length > 0) await batch.commit();

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
