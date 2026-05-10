import { db } from "./firebase";
import {
  doc, getDoc, setDoc, getDocs, writeBatch,
  collection, query, where, updateDoc,
} from "firebase/firestore";

const CARD_ID = "virtual-park";
const RACE_COUNT = 6;
const HORSES_PER_RACE = 8;
const RACE_GAP_MS = 20 * 60 * 1000;   // 20 min between races
const START_OFFSET_MS = 3 * 60 * 1000; // first race 3 min after seed

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

/**
 * Seeds or resets the Virtual Park test track.
 * Safe to call multiple times — skips if the card is still fresh.
 * Uses the authenticated Firebase client SDK, no credentials needed.
 */
export async function seedVirtualTrack(): Promise<void> {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Check if the existing card is still fresh
  const cardRef = doc(db, "cards", CARD_ID);
  const cardDoc = await getDoc(cardRef);
  if (cardDoc.exists()) {
    const postTime = new Date(cardDoc.data().postTime).getTime();
    const lastRaceTime = postTime + (RACE_COUNT - 1) * RACE_GAP_MS;
    if (now < lastRaceTime + 5 * 60 * 1000) return; // still running or just finished
  }

  // Settle any unsettled virtual races from the previous cycle
  for (let raceNum = 1; raceNum <= RACE_COUNT; raceNum++) {
    const raceId = `${CARD_ID}-r${raceNum}`;
    const raceRef = doc(db, "races", raceId);
    const raceSnap = await getDoc(raceRef);
    if (!raceSnap.exists()) continue;
    const race = raceSnap.data();
    if (race.status === "settled") continue;
    if (!race.offTime || new Date(race.offTime).getTime() > now) continue;

    // Pick random winners
    const horsesSnap = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceId))
    );
    const horseIds = shuffle(horsesSnap.docs.map(h => h.id));
    if (horseIds.length < 3) continue;

    const winners = { first: horseIds[0], second: horseIds[1], third: horseIds[2] };
    await updateDoc(raceRef, { status: "settled", winners });

    // Score picks
    const picksSnap = await getDocs(
      query(collection(db, "picks"), where("raceId", "==", raceId))
    );
    if (!picksSnap.empty) {
      const batch = writeBatch(db);
      picksSnap.docs.forEach(p => {
        const { horseId } = p.data();
        let points = 0;
        if (horseId === winners.first) points = 5;
        else if (horseId === winners.second) points = 3;
        else if (horseId === winners.third) points = 1;
        batch.update(p.ref, { points });
      });
      await batch.commit();
    }
  }

  // Write new virtual card
  const firstRaceTime = now + START_OFFSET_MS;
  const firstRaceISO = new Date(firstRaceTime).toISOString();

  await setDoc(cardRef, {
    trackName: "VIRTUAL PARK",
    raceDate: today,
    postTime: firstRaceISO,
    status: "upcoming",
    isVirtual: true,
    raceCount: RACE_COUNT,
  });

  // Write new races and horses
  const allNames = shuffle(HORSE_NAMES);

  for (let raceNum = 1; raceNum <= RACE_COUNT; raceNum++) {
    const raceId = `${CARD_ID}-r${raceNum}`;
    const offTime = new Date(firstRaceTime + (raceNum - 1) * RACE_GAP_MS).toISOString();

    await setDoc(doc(db, "races", raceId), {
      cardId: CARD_ID,
      raceNumber: raceNum,
      name: `RACE ${raceNum}`,
      offTime,
      status: "upcoming",
      winners: null,
      isVirtual: true,
    });

    const raceHorses = allNames.slice((raceNum - 1) * HORSES_PER_RACE, raceNum * HORSES_PER_RACE);
    const batch = writeBatch(db);
    raceHorses.forEach((name, idx) => {
      batch.set(doc(db, "horses", `${raceId}-h${idx + 1}`), {
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
}
