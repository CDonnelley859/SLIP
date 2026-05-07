import { db } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDocs, query,
  where, writeBatch,
} from "firebase/firestore";

const API_KEY = import.meta.env.VITE_RACING_API_KEY;
const BASE = "https://api.theracingapi.com/v1";

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`Racing API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// 1st = 5pts, 2nd = 3pts, 3rd = 1pt
function pointsForPosition(position: number): number {
  if (position === 1) return 5;
  if (position === 2) return 3;
  if (position === 3) return 1;
  return 0;
}

export async function syncCards(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/racecards/pro?date=${today}&region=gb`);
  const racecards = data.racecards ?? [];

  const batch = writeBatch(db);
  let count = 0;

  for (const card of racecards) {
    const courseId = card.course_id ?? card.course.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseId}`;
    const cardRef = doc(db, "cards", cardId);

    batch.set(cardRef, {
      trackName: card.course,
      raceDate: today,
      postTime: card.races?.[0]?.off_time ?? `${today}T12:00:00Z`,
      status: "upcoming",
      sourceId: cardId,
    }, { merge: true });

    for (const race of card.races ?? []) {
      const raceRef = doc(db, "cards", cardId, "races", race.race_id);
      batch.set(raceRef, {
        raceNumber: race.race_num ?? race.race_number,
        name: race.race_name ?? null,
        offTime: race.off_time,
        status: "upcoming",
        winners: null,
      }, { merge: true });

      for (const runner of race.runners ?? []) {
        const horseRef = doc(db, "cards", cardId, "races", race.race_id, "horses", runner.horse_id ?? String(runner.number));
        batch.set(horseRef, {
          number: runner.number,
          name: runner.horse,
          jockey: runner.jockey ?? null,
          odds: runner.sp_dec ? `${runner.sp_dec}` : runner.odds ?? null,
        }, { merge: true });
      }

      count++;
    }
  }

  await batch.commit();
  return count;
}

export async function syncResults(cardId: string): Promise<void> {
  const racesSnap = await getDocs(collection(db, "cards", cardId, "races"));

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled") continue;

    try {
      const data = await apiFetch(`/results/${raceDoc.id}`);
      const result = data.result ?? data;
      const runners: any[] = result.runners ?? [];

      const getRunnerAtPosition = (pos: number) =>
        runners.find((r: any) => Number(r.position) === pos);

      const first = getRunnerAtPosition(1);
      const second = getRunnerAtPosition(2);
      const third = getRunnerAtPosition(3);

      if (!first) continue;

      const batch = writeBatch(db);

      batch.update(doc(db, "cards", cardId, "races", raceDoc.id), {
        status: "settled",
        winners: {
          first: first.horse_id ?? null,
          second: second?.horse_id ?? null,
          third: third?.horse_id ?? null,
        },
      });

      const scrumSnap = await getDocs(
        query(collection(db, "scrums"), where("cardId", "==", cardId))
      );

      for (const scrumDoc of scrumSnap.docs) {
        const picksSnap = await getDocs(
          query(collection(db, "scrums", scrumDoc.id, "picks"), where("raceId", "==", raceDoc.id))
        );
        for (const pickDoc of picksSnap.docs) {
          const { horseId } = pickDoc.data();
          let points = 0;
          if (horseId === first.horse_id) points = 5;
          else if (horseId === second?.horse_id) points = 3;
          else if (horseId === third?.horse_id) points = 1;
          batch.update(pickDoc.ref, { points });
        }
      }

      await batch.commit();
    } catch {
      // result not available yet — skip silently
    }
  }
}
