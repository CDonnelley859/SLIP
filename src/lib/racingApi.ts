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

// Strip country suffix: "Rubellite (IRE)" → "RUBELLITE"
function normaliseName(name: string): string {
  return name.replace(/\s*\([A-Z]+\)\s*$/, "").trim().toUpperCase();
}

// Strip surface suffix: "Wolverhampton (AW)" → "wolverhampton"
function normaliseCourse(course: string): string {
  return course.replace(/\s*\(AW\)\s*$/, "").trim().toLowerCase();
}

export async function syncResults(cardId: string): Promise<void> {
  const cardDoc = await getDoc(doc(db, "cards", cardId));
  if (!cardDoc.exists()) return;
  const { trackName } = cardDoc.data();
  const normTrack = normaliseCourse(trackName);

  // Fetch today's results from The Racing API (requires Basic plan or above)
  let traRaces: any[] = [];
  try {
    const data = await apiFetch(`/results`);
    // TRA format: { results: [ { course, off_dt, runners: [{ horse, position }] } ] }
    traRaces = data?.results ?? [];
  } catch {
    return; // Results not available yet
  }

  // Filter to races at this track
  const trackRaces = traRaces.filter(
    (r: any) => normaliseCourse(r.course ?? "") === normTrack
  );
  if (trackRaces.length === 0) return;

  // Get all races for this card
  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled") continue;
    if (!race.offTime) continue;

    const raceUTC = new Date(race.offTime).getTime();

    // Find the TRA race whose off_dt is closest to our stored offTime (within 5 min)
    const match = trackRaces.find((r: any) => {
      const traTime = new Date(r.off_dt).getTime();
      return Math.abs(traTime - raceUTC) < 5 * 60 * 1000;
    });
    if (!match) continue;

    const runners: any[] = match.runners ?? [];
    const atPos = (pos: string) => runners.find((r: any) => String(r.position) === pos);
    const first = atPos("1");
    const second = atPos("2");
    const third = atPos("3");
    if (!first) continue;

    // Look up Firestore horse IDs by normalised name
    const horsesSnap = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceDoc.id))
    );
    const nameToId: Record<string, string> = {};
    horsesSnap.docs.forEach(h => {
      nameToId[normaliseName(h.data().name ?? "")] = h.id;
    });

    const toId = (runner: any) =>
      runner ? (nameToId[normaliseName(runner.horse ?? "")] ?? null) : null;

    const winners = {
      first: toId(first),
      second: toId(second),
      third: toId(third),
    };

    if (!winners.first) continue;

    await updateDoc(raceDoc.ref, { status: "settled", winners });

    const picksSnap = await getDocs(
      query(collection(db, "picks"), where("raceId", "==", raceDoc.id))
    );
    const batch = writeBatch(db);
    for (const pickDoc of picksSnap.docs) {
      const { horseId } = pickDoc.data();
      let points = 0;
      if (horseId === winners.first) points = 5;
      else if (horseId === winners.second) points = 3;
      else if (horseId === winners.third) points = 1;
      batch.update(pickDoc.ref, { points });
    }
    await batch.commit();
  }
}
