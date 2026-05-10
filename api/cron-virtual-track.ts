import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

const CARD_ID = "virtual-park";
const RACE_COUNT = 6;
const HORSES_PER_RACE = 8;
const RACE_GAP_MS = 20 * 60 * 1000;   // 20 minutes between races
const START_OFFSET_MS = 3 * 60 * 1000; // first race 3 min after reset
const COOLDOWN_MS = 90 * 60 * 1000;   // minimum 90 min between resets

const HORSE_NAMES = [
  "IRON BLOTTO", "SILVER SLIP", "FAST TRACK", "DARK HORSE", "LUCKY CHARM",
  "THUNDER RUN", "MORNING GLORY", "GOLDEN STREAK", "SWIFT ARROW", "NIGHT RIDER",
  "BOLD MOVE", "CRIMSON TIDE", "WILD CARD", "LAST FURLONG", "STEADY ODDS",
  "SURE BET", "LONG SHOT", "PHOTO FINISH", "FLYING COLOURS", "HOT FAVOURITE",
  "TURF KING", "FLAT CAP", "BEAT THE ODDS", "OUTSIDER", "ANTE POST",
  "FALSE START", "DEAD HEAT", "GOING SOFT", "GOOD TO FIRM", "HEAVY GOING",
  "STARTING GUN", "BACK MARKER", "FRONT RUNNER", "PACEMAKER", "NOSE AHEAD",
  "SILKS AND SPURS", "THE GALLOPER", "PADDOCK STAR", "SLIP UP", "PRINT IT",
  "DAILY DOUBLE", "EACH WAY", "PLACE BET", "ACCUMULATOR", "YANKEE SPECIAL",
  "TOTE MAGIC", "RACING POST", "FORM GUIDE", "TIP MASTER", "THE FAVOURITE",
];

const JOCKEYS = [
  "J. GALLOP", "A. SWIFT", "T. HOOVES", "M. SADDLE", "P. STIRRUP",
  "R. CANTER", "L. TROT", "B. GALLOP", "C. WHIP", "D. FENCE",
];

const TRAINERS = [
  "T. STABLES", "A. YARD", "B. HEATH", "C. DOWNS", "D. TURF",
  "E. TRACK", "F. FURLONG", "G. STRAIGHT", "H. BEND", "I. PADDOCK",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getFirestore();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // --- Rate limit: prevent resets more than once per 90 minutes ---
  const metaRef = db.collection("_meta").doc("virtual-track");
  const metaDoc = await metaRef.get();
  const lastReset = metaDoc.data()?.lastReset ?? 0;
  if (now - lastReset < COOLDOWN_MS) {
    return res.json({ ok: true, skipped: true, reason: "cooldown", nextResetIn: Math.round((COOLDOWN_MS - (now - lastReset)) / 60000) + "min" });
  }

  // Claim the reset slot immediately to prevent concurrent resets
  await metaRef.set({ lastReset: now });

  // --- STEP 1: Settle any unsettled virtual races from the previous cycle ---
  let settled = 0;
  for (let raceNum = 1; raceNum <= RACE_COUNT; raceNum++) {
    const raceId = `${CARD_ID}-r${raceNum}`;
    const raceDoc = await db.collection("races").doc(raceId).get();
    if (!raceDoc.exists) continue;
    const race = raceDoc.data()!;
    if (race.status === "settled") continue;
    if (!race.offTime) continue;
    if (new Date(race.offTime).getTime() > now) continue; // not yet run

    // Pick random winners from horses in this race
    const horsesSnap = await db.collection("horses").where("raceId", "==", raceId).get();
    const horseIds = shuffle(horsesSnap.docs.map(h => h.id));
    if (horseIds.length < 3) continue;

    const winners = { first: horseIds[0], second: horseIds[1], third: horseIds[2] };
    await raceDoc.ref.update({ status: "settled", winners });

    // Score picks
    const picksSnap = await db.collection("picks").where("raceId", "==", raceId).get();
    if (!picksSnap.empty) {
      const batch = db.batch();
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
    settled++;
  }

  // --- STEP 2: Write new virtual card ---
  const firstRaceTime = now + START_OFFSET_MS;
  const firstRaceISO = new Date(firstRaceTime).toISOString();

  await db.collection("cards").doc(CARD_ID).set({
    trackName: "VIRTUAL PARK",
    raceDate: today,
    postTime: firstRaceISO,
    status: "upcoming",
    isVirtual: true,
    raceCount: RACE_COUNT,
  });

  // --- STEP 3: Write new races and horses ---
  // Use all 50 horse names, shuffled, then deal out 8 per race
  const allNames = shuffle(HORSE_NAMES);

  for (let raceNum = 1; raceNum <= RACE_COUNT; raceNum++) {
    const raceId = `${CARD_ID}-r${raceNum}`;
    const offTime = new Date(firstRaceTime + (raceNum - 1) * RACE_GAP_MS).toISOString();

    await db.collection("races").doc(raceId).set({
      cardId: CARD_ID,
      raceNumber: raceNum,
      name: `RACE ${raceNum}`,
      offTime,
      status: "upcoming",
      winners: null,
      isVirtual: true,
    });

    const raceHorseNames = allNames.slice((raceNum - 1) * HORSES_PER_RACE, raceNum * HORSES_PER_RACE);
    const batch = db.batch();
    raceHorseNames.forEach((name, idx) => {
      const horseId = `${raceId}-h${idx + 1}`;
      batch.set(db.collection("horses").doc(horseId), {
        raceId,
        number: idx + 1,
        name,
        jockey: JOCKEYS[idx % JOCKEYS.length],
        trainer: TRAINERS[idx % TRAINERS.length],
        owner: null,
        form: null,
        lbs: null,
        odds: null,
      });
    });
    await batch.commit();
  }

  res.json({ ok: true, settled, today, firstRace: firstRaceISO, racesCreated: RACE_COUNT });
}
