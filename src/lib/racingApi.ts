import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, setDoc, getDocs, query, where, updateDoc, writeBatch,
} from "firebase/firestore";

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Strip any country/surface suffix: "Wolverhampton (AW)" → "wolverhampton"
function normaliseCourse(course: string): string {
  return course.replace(/\s*\([^)]+\)\s*$/, "").trim().toLowerCase();
}

// Display name from TRA course: "Wolverhampton (AW)" → "Wolverhampton"
function displayName(course: string): string {
  return normaliseCourse(course)
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Strip country suffix from horse name: "Rubellite (IRE)" → "RUBELLITE"
function normaliseName(name: string): string {
  return name.replace(/\s*\([A-Z]+\)\s*$/, "").trim().toUpperCase();
}

// Syncs today's cards, races, and horses from TRA /racecards/free
export async function syncCards(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/tra-racecards`);
  const racecards: any[] = data?.racecards ?? [];

  // Group racecards by normalised course name
  const byCourse: Record<string, any[]> = {};
  for (const rc of racecards) {
    const norm = normaliseCourse(rc.course ?? "");
    if (!norm) continue;
    if (!byCourse[norm]) byCourse[norm] = [];
    byCourse[norm].push(rc);
  }

  let raceCount = 0;
  let horseCount = 0;

  for (const [normCourse, courseRacecards] of Object.entries(byCourse)) {
    if (courseRacecards.length === 0) continue;

    // Sort by off time
    courseRacecards.sort((a, b) =>
      new Date(a.off_dt).getTime() - new Date(b.off_dt).getTime()
    );

    const trackName = displayName(courseRacecards[0].course);
    const courseSlug = normCourse.replace(/\s+/g, "-");
    const cardId = `${today}-${courseSlug}`;

    await setDoc(doc(db, "cards", cardId), {
      trackName,
      raceDate: today,
      postTime: courseRacecards[0].off_dt,
      status: "upcoming",
      sourceId: cardId,
      raceCount: courseRacecards.length,
    }, { merge: true });

    for (let i = 0; i < courseRacecards.length; i++) {
      const rc = courseRacecards[i];
      const raceNum = i + 1;
      const raceId = `${cardId}-r${raceNum}`;

      await setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: rc.race_name ?? null,
        offTime: rc.off_dt,
        status: "upcoming",
        winners: null,
        sourceId: raceId,
      }, { merge: true });

      const runners: any[] = rc.runners ?? [];
      if (runners.length > 0) {
        const batch = writeBatch(db);
        runners.forEach((runner, idx) => {
          const horseId = `${raceId}-h${idx + 1}`;
          batch.set(doc(db, "horses", horseId), {
            raceId,
            number: Number(runner.number) || idx + 1,
            name: runner.horse ?? "Unknown",
            jockey: runner.jockey ?? null,
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

// Syncs runners for a specific card from TRA /racecards/free
// Called when Gallop opens and a race has no horses
export async function syncRunners(cardId: string): Promise<number> {
  const cardDoc = await getDoc(doc(db, "cards", cardId));
  if (!cardDoc.exists()) return 0;
  const { trackName } = cardDoc.data();
  const normTrack = normaliseCourse(trackName);

  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );
  if (racesSnap.empty) return 0;

  // Only process races that have no horses yet
  const racesNeedingRunners: typeof racesSnap.docs = [];
  for (const raceDoc of racesSnap.docs) {
    const existing = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceDoc.id))
    );
    if (existing.empty) racesNeedingRunners.push(raceDoc);
  }
  if (racesNeedingRunners.length === 0) return 0;

  const data = await apiFetch(`/tra-racecards`);
  const traCards: any[] = data?.racecards ?? [];
  const trackCards = traCards.filter(
    (rc: any) => normaliseCourse(rc.course ?? "") === normTrack
  );
  if (trackCards.length === 0) return 0;

  let horseCount = 0;

  for (const raceDoc of racesNeedingRunners) {
    const race = raceDoc.data();
    if (!race.offTime) continue;
    const raceUTC = new Date(race.offTime).getTime();

    const match = trackCards.find((rc: any) => {
      const traTime = new Date(rc.off_dt).getTime();
      return Math.abs(traTime - raceUTC) < 5 * 60 * 1000;
    });
    if (!match) continue;

    const runners: any[] = match.runners ?? [];
    if (runners.length === 0) continue;

    const batch = writeBatch(db);
    runners.forEach((runner, idx) => {
      const horseId = `${raceDoc.id}-h${idx + 1}`;
      batch.set(doc(db, "horses", horseId), {
        raceId: raceDoc.id,
        number: Number(runner.number) || idx + 1,
        name: runner.horse ?? "Unknown",
        jockey: runner.jockey ?? null,
        odds: null,
      }, { merge: true });
      horseCount++;
    });
    await batch.commit();
  }

  return horseCount;
}

// Syncs results for a specific card from TRA /results/today/free
export async function syncResults(cardId: string): Promise<void> {
  const cardDoc = await getDoc(doc(db, "cards", cardId));
  if (!cardDoc.exists()) return;
  const { trackName } = cardDoc.data();
  const normTrack = normaliseCourse(trackName);

  let traRaces: any[] = [];
  try {
    const data = await apiFetch(`/results`);
    traRaces = data?.results ?? [];
  } catch {
    return;
  }

  const trackRaces = traRaces.filter(
    (r: any) => normaliseCourse(r.course ?? "") === normTrack
  );
  if (trackRaces.length === 0) return;

  const racesSnap = await getDocs(
    query(collection(db, "races"), where("cardId", "==", cardId))
  );

  for (const raceDoc of racesSnap.docs) {
    const race = raceDoc.data();
    if (race.status === "settled") continue;
    if (!race.offTime) continue;

    const raceUTC = new Date(race.offTime).getTime();

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
