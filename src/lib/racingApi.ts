import { db } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDocs, query,
  where, writeBatch, Timestamp,
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

// Pull today's UK racecards and write to Firestore
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

// Pull results for a card and update picks with points
export async function syncResults(cardId: string): Promise<void> {
  const racesSnap = await getDocs(collection(db, "cards", cardId, "races"));

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled") continue;

    try {
      const data = await apiFetch(`/results/${raceDoc.id}`);
      const result = data.result ?? data;
      const winner = result.runners?.find((r: any) => r.position === 1);
      if (!winner) continue;

      const batch = writeBatch(db);

      // Mark race settled
      batch.update(doc(db, "cards", cardId, "races", raceDoc.id), {
        status: "settled",
        winners: [{ horseId: winner.horse_id, horseName: winner.horse, position: 1 }],
      });

      // Find all picks for this race across all scrums and award points
      const scrumPicksSnap = await getDocs(
        query(collection(db, "scrums"), where("cardId", "==", cardId))
      );

      for (const scrumDoc of scrumPicksSnap.docs) {
        const picksSnap = await getDocs(
          query(collection(db, "scrums", scrumDoc.id, "picks"), where("raceId", "==", raceDoc.id))
        );
        for (const pickDoc of picksSnap.docs) {
          const pick = pickDoc.data();
          const horsesSnap = await getDocs(collection(db, "cards", cardId, "races", raceDoc.id, "horses"));
          const horse = horsesSnap.docs.find(h => h.id === pick.horseId);
          const horseName = horse?.data().name ?? "";
          const isWinner = horseName.toLowerCase() === winner.horse.toLowerCase();
          batch.update(pickDoc.ref, { points: isWinner ? 1 : 0 });
        }
      }

      await batch.commit();
    } catch {
      // Race result not available yet — skip silently
    }
  }
}
