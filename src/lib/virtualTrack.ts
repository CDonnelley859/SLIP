import { db } from "./firebase";
import {
  doc, getDoc, setDoc, getDocs, writeBatch, deleteDoc,
  collection, query, where, updateDoc,
} from "firebase/firestore";

const CARD_PREFIX = "blotto-park";
export const RACE_COUNT = 6;
const HORSES_PER_RACE = 8;
export const RACE_GAP_MS = 20 * 60 * 1000;          // 20 minutes between races
export const CARD_DURATION_MS = RACE_COUNT * RACE_GAP_MS;  // 2 hours per card
const CARDS_AHEAD = 2;                                // show current + 2 upcoming = 3 total

const HORSE_NAMES = [
  // British Pub Classics & Tavern Vibes
  "THE TIPSY TAILOR", "HOPS AND GLORY", "THE PINT-SIZED PONY", "RUSTY ANCHOR",
  "RED LION", "CROWN & ANCHOR", "BARLEY MOW", "THE DRUNKEN STALLION",
  "OLD THUMPER", "THE SNUG", "LAST ORDERS", "LOCK-IN",
  "PUBLICAN'S PRIDE", "THE FOAMY TANKARD", "WAGGON & HORSES", "THE NAG'S HEAD",
  "STICKY CARPET", "DARTS BOARD HERO", "FRUIT MACHINE", "PORK SCRATCHING",
  "BOUNCER'S NOD", "PICKLED EGG", "JUKEBOX JURY", "CRISP PACKET", "THE LOCAL LEGEND",
  // Spirits, Cocktails & UK Brews
  "BRAMBLE", "ELDERFLOWER SPRITZ", "OLD FASHIONED", "DARK 'N' STORMY",
  "GIN IT TO WIN IT", "MARTINI DASH", "WHISKEY NEAT", "SLOE GIN FIZZ",
  "TEQUILA SUNRISE", "VELVET ESPRESSO", "MOSCOW MULE", "JÄGER DASH",
  "BABY GUINNESS", "ABSINTHE MINDED", "COTSWOLD GIN", "THATCHERS GOLD",
  "LONDON PRIDE", "DOOM BAR", "STOUT FELLOW", "PERRY",
  "HOBGOBLIN", "SCRUMPY JACK", "OLD PECULIER", "GUINNESS DRAUGHT", "STRONGBOW",
  "BUCKFAST COMMOTION", "MAD DOG 20/20", "SNAKEBITE & BLACK", "TURBO SHANDY",
  "TENNENT'S SUPER", "BLUE WKD", "FROSTY JACK", "NEWCASTLE BROWN",
  "SPECIAL BREW", "IRON BREW GIN",
  // Equestrian Puns
  "STIRRUP SOME TROUBLE", "ONE MORE STIRRUP-CUP", "GIN-NY UP", "BIT AND BITTER",
  "BRIDLE & BOTTLE", "REIN IT IN", "WHOA-A-CHARDONNAY", "CANTER-BURY ALE",
  "GALLOPING GROG", "TROT-QUILA SLAMMER", "GIDDY-UP GIN", "HAY-ZY IPA",
  "MANE-HATTAN", "SADDLE-SODA", "WHINNY AND TONIC", "MARE-TINI SHAKE",
  "LONG FACE LONG ISLAND", "BUCKING BOOZED", "PONY UP THE CASH",
  "THE NEIGH-BOUR'S ROUND", "HOOFIN' THE HOOCH", "PASTURE MY BEDTIME",
  "THE DRUNKEN DRESSAGE", "FURLONG BENDER", "CLYDESDALE COCKTAIL",
  "SHETLAND SHOT-GLASS", "HIGH STEPPER HEAVY SIPPER", "UNBRIDLED SPIRITS",
  "HALT AND POUR", "STRAIGHT FROM THE HORSE'S MOUTH", "DOWN-AND-DERBY",
  "THE SOCIAL STIRRUP", "WHINNY-FALL", "FINISH YOUR GALLOP",
  "TWO-STRIDE PENALTY", "RULE MAKER'S MANE", "THE DESIGNATED CANTER",
  "DOUBLE-SHOT DASH", "BACK-TO-THE-BARN",
  // Drinking Game Specials
  "QUESTION MASTER'S MARE", "THUMB-MASTER'S TROT", "FORFEIT FILLY",
  "VIKING'S CHUG", "FINGER ON THE CUP", "THE RED-CARD RUNNER",
  "THE INFORMANT'S FLIP", "ACE OF BRAIDS", "SUITED AND BOOTED",
  "ROYAL FLUSH RUSH", "HOUSE RULES", "THE DEALER'S DRAW", "DECK OF DOOM",
  "HIGH-NOON HANGOVER", "HIGHER OR LOWER", "RED OR BLACK JACK",
  "BEER-PONG PONY", "KINGS-CUP KICKER", "RING OF FIRE-FLYER",
  "FLIP-CUP FLYER", "THE QUARTERS COLT", "BOAT RACE WINNER",
  "PENNYING THE PINT", "YARDS OF ALE", "THE LAST ORDERS LAP",
  "SHOT-GLASS SPRINT",
  // British Slang
  "HAIR OF THE DOG", "ONE FOR THE ROAD", "BOTTOMS UP", "FANCY A PINT?",
  "CHEEKY HALF", "MORTAL", "TWO SHEETS", "BOOZY BLITZ", "LIQUID COURAGE",
  "ON THE ROCKS", "TACTICAL CHUNDER", "GROGGY STAGGERS", "PISSED AS A NEWT",
  "BEER FEAR", "EAT MY BUBBLES", "PROPER GRAFT", "BENDER'S END", "STEAMING",
  "GOGGLE-EYED", "THE MORNING AFTER", "OFF THE WAGON", "VINO VERDICT",
  "NAPPING IN THE PADDOCK", "WONKY DONKEY PINT", "THE WINNING TOAST",
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

// ── Slot helpers ──────────────────────────────────────────────────────────────

function dayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function slotFor(now: number): number {
  return Math.floor((now - dayStart()) / CARD_DURATION_MS);
}

function cardIdForSlot(slot: number): string {
  return `${CARD_PREFIX}-s${slot}`;
}

function slotStartMs(slot: number): number {
  return dayStart() + slot * CARD_DURATION_MS;
}

/**
 * Returns the card IDs for the current slot and the next CARDS_AHEAD slots.
 * These are the cards that should be visible in the carousel at any given time.
 */
export function activeVirtualCardIds(now = Date.now()): string[] {
  const slot = slotFor(now);
  return Array.from({ length: CARDS_AHEAD + 1 }, (_, i) => cardIdForSlot(slot + i));
}

// ── Settlement ────────────────────────────────────────────────────────────────

async function settleCardRaces(cardId: string): Promise<void> {
  const now = Date.now();
  const raceIds = Array.from({ length: RACE_COUNT }, (_, i) => `${cardId}-r${i + 1}`);
  const raceSnaps = await Promise.all(raceIds.map(id => getDoc(doc(db, "races", id))));

  const racesToSettle = raceSnaps.filter(snap => {
    if (!snap.exists()) return false;
    const race = snap.data();
    if (race.status === "settled") return false;
    if (!race.offTime || new Date(race.offTime).getTime() > now) return false;
    return true;
  });

  await Promise.all(racesToSettle.map(async (raceSnap) => {
    const raceRef = raceSnap.ref;
    const raceId = raceSnap.id;

    const horsesSnap = await getDocs(
      query(collection(db, "horses"), where("raceId", "==", raceId))
    );
    const horseIds = shuffle(horsesSnap.docs.map(h => h.id));
    if (horseIds.length < 3) return;

    const winners = { first: horseIds[0], second: horseIds[1], third: horseIds[2] };
    await updateDoc(raceRef, { status: "settled", winners });

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
  }));
}

/** Settle finished races across all currently-active virtual cards. Safe to call any time. */
export async function settleVirtualRaces(): Promise<void> {
  try {
    const now = Date.now();
    // Include the previous slot too — it may have just finished
    const prevSlot = cardIdForSlot(slotFor(now) - 1);
    const ids = [prevSlot, ...activeVirtualCardIds(now)];
    await Promise.all(ids.map(id => settleCardRaces(id).catch(() => {})));
  } catch { }
}

// ── Seeding ───────────────────────────────────────────────────────────────────

async function seedSlot(slotNum: number): Promise<void> {
  const cardId = cardIdForSlot(slotNum);
  const firstRaceTime = slotStartMs(slotNum);
  const firstRaceISO = new Date(firstRaceTime).toISOString();

  // Skip if already seeded — never overwrite an existing card
  const cardRef = doc(db, "cards", cardId);
  const cardDoc = await getDoc(cardRef);
  if (cardDoc.exists()) return;

  await setDoc(cardRef, {
    trackName: "BLOTTO PARK",
    raceDate: new Date(firstRaceTime).toISOString().slice(0, 10),
    postTime: firstRaceISO,
    status: "upcoming",
    isVirtual: true,
    raceCount: RACE_COUNT,
  });

  const allNames = shuffle(HORSE_NAMES);

  await Promise.all(
    Array.from({ length: RACE_COUNT }, (_, i) => {
      const raceNum = i + 1;
      const raceId = `${cardId}-r${raceNum}`;
      const offTime = new Date(firstRaceTime + i * RACE_GAP_MS).toISOString();

      const raceWrite = setDoc(doc(db, "races", raceId), {
        cardId,
        raceNumber: raceNum,
        name: `RACE ${raceNum}`,
        offTime,
        status: "upcoming",
        winners: null,
        isVirtual: true,
      });

      const raceHorses = allNames.slice(i * HORSES_PER_RACE, (i + 1) * HORSES_PER_RACE);
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

      return Promise.all([raceWrite, batch.commit()]);
    })
  );
}

/**
 * Seeds all currently-visible virtual cards (current slot + CARDS_AHEAD ahead).
 * Skips any slot that already has a card in Firestore. Safe to call at any time.
 */
export async function seedVirtualTrack(): Promise<void> {
  const now = Date.now();

  // One-time migration: delete the old single-ID card and its races/horses
  try {
    const oldCard = await getDoc(doc(db, "cards", CARD_PREFIX));
    if (oldCard.exists()) {
      const cleanupBatch = writeBatch(db);
      cleanupBatch.delete(doc(db, "cards", CARD_PREFIX));
      for (let n = 1; n <= 12; n++) {
        const oldRaceId = `${CARD_PREFIX}-r${n}`;
        cleanupBatch.delete(doc(db, "races", oldRaceId));
        for (let h = 1; h <= HORSES_PER_RACE; h++) {
          cleanupBatch.delete(doc(db, "horses", `${oldRaceId}-h${h}`));
        }
      }
      await cleanupBatch.commit();
    }
  } catch { }

  // One-time migration: remove old "virtual-park" card if it still exists
  try { await deleteDoc(doc(db, "cards", "virtual-park")); } catch { }

  // Settle any finished races before seeding
  try { await settleVirtualRaces(); } catch { }

  // Seed all active slots in parallel
  const currentSlot = slotFor(now);
  await Promise.all(
    Array.from({ length: CARDS_AHEAD + 1 }, (_, i) => seedSlot(currentSlot + i).catch(() => {}))
  );
}
