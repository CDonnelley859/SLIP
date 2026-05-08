import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, setDoc, getDocs, query, where, updateDoc, writeBatch,
} from "firebase/firestore";

// OurHub times are 12-hour UK local (e.g. "01:50" = 1:50 PM BST)
// Convert to proper UTC ISO string for storage
function raceTimeToISO(dateStr: string, time12h: string): string {
  const [h, m] = (time12h ?? "12:00").split(":").map(Number);
  const h24 = h < 12 ? h + 12 : h; // UK racing is always afternoon
  const month = parseInt(dateStr.split("-")[1]);
  const isBST = month >= 4 && month <= 10; // Apr–Oct = BST (UTC+1)
  const utcH = h24 - (isBST ? 1 : 0);
  return `${dateStr}T${String(utcH).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
}

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
  // runners is { "Ascot": { "13:50": [...runners] } }
  const runners: Record<string, Record<string, any[]>> = data.runners ?? {};
  let raceCount = 0;
  let horseCount = 0;

  for (const [trackName, races] of Object.entries(courses)) {
    if (!Array.isArray(races) || races.length === 0) continue;

    const courseSlug = trackName.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseSlug}`;
    const firstRaceTime = races[0]?.race_time ?? "12:00";

    await setDoc(doc(db, "cards", cardId), {
      trackName,
      raceDate: today,
      postTime: raceTimeToISO(today, firstRaceTime),
      status: "upcoming",
      sourceId: cardId,
      raceCount: races.length,
    }, { merge: true });

    const trackRunners: Record<string, any[]> = runners[trackName] ?? {};

    for (let i = 0; i < races.length; i++) {
      const race = races[i];
      const raceNum = i + 1;
      const raceId = `${cardId}-r${raceNum}`;
      const raceTime = race.race_time ?? "12:00";

      await setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: race.race_name ?? null,
        offTime: raceTimeToISO(today, raceTime),
        status: "upcoming",
        winners: null,
        sourceId: raceId,
      }, { merge: true });

      const raceRunners: any[] = trackRunners[raceTime] ?? [];
      if (raceRunners.length > 0) {
        const batch = writeBatch(db);
        raceRunners.forEach((runner, idx) => {
          const horseId = `${raceId}-h${idx + 1}`;
          batch.set(doc(db, "horses", horseId), {
            raceId,
            number: Number(runner.number) || idx + 1,
            name: runner.horse_name ?? runner.horse ?? "Unknown",
            jockey: runner.jockey_name ?? runner.jockey ?? null,
            odds: null,
          }, { merge: true });
          horseCount++;
        });
        await batch.commit();
      }

      raceCount++;
    }
  }

  return `${raceCount} races, ${horseCount} horses`;
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
  // Get card to find the date and track name
  const cardDoc = await getDoc(doc(db, "cards", cardId));
  if (!cardDoc.exists()) return;
  const card = cardDoc.data();
  const { raceDate, trackName } = card;

  // Fetch all results for today from OurHub
  let allResults: Record<string, any[]> = {};
  try {
    const data = await apiFetch(`/results?date=${raceDate}`);
    // OurHub result-info format mirrors runner-info:
    // { "Ascot 13:50 Race Name": [...runners with position] }
    allResults = data ?? {};
  } catch {
    return; // Results not available yet
  }

  // Get all races for this card
  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled") continue;

    // Convert stored UTC offTime back to local race time string to match OurHub key
    const offDate = new Date(race.offTime);
    const localH = offDate.getUTCHours() + (raceDate >= "2026-04" && raceDate <= "2026-10" ? 1 : 0);
    const localM = offDate.getUTCMinutes();
    const timeStr = `${String(localH).padStart(2, "0")}:${String(localM).padStart(2, "0")}`;

    // Find the matching result entry by track name + time
    const resultKey = Object.keys(allResults).find(
      k => k.startsWith(trackName) && k.includes(timeStr)
    );
    if (!resultKey) continue;

    const runners: any[] = allResults[resultKey] ?? [];
    const getAt = (pos: number) =>
      runners.find((r: any) => Number(r.position) === pos || r.finishing_position === String(pos));
    const first = getAt(1);
    const second = getAt(2);
    const third = getAt(3);
    if (!first) continue;

    // Look up Firestore horse IDs by name so picks can be matched correctly
    const horsesSnap = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceDoc.id))
    );
    const nameToId: Record<string, string> = {};
    horsesSnap.docs.forEach(h => {
      const name = (h.data().name ?? "").toUpperCase();
      nameToId[name] = h.id;
    });

    const toId = (runner: any) => {
      if (!runner) return null;
      const name = (runner.horse_name ?? runner.horse ?? "").toUpperCase();
      return nameToId[name] ?? null;
    };

    const winners = {
      first: toId(first),
      second: toId(second),
      third: toId(third),
    };

    if (!winners.first) continue; // Couldn't match winner — skip

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
  }
}
