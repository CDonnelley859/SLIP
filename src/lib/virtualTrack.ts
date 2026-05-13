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
const TOTAL_DAILY_SLOTS = 12;                         // all 12 venues visible all day

// Ordered east → west by time zone so each slot roughly matches
// when UK punters would watch these venues live. Blotto Park is fixed
// at index 10 = the 20:00 slot.
const VENUES = [
  {
    name: "TOP-SHELFINGTON PARK",
    tagline: "",
  },
  {
    name: "ON-THE-ROCKSBURY DOWNS",
    tagline: "",
  },
  {
    name: "JUNIPER-WICK PARK",
    tagline: "",
  },
  {
    name: "PROOFLEY-ON-STIR",
    tagline: "",
  },
  {
    name: "MALT-ON-THE-HILL",
    tagline: "",
  },
  {
    name: "DASHWORTH VALLEY",
    tagline: "",
  },
  {
    name: "SLOE-GINBURY FIELDS",
    tagline: "",
  },
  {
    name: "LAST-CALL-WORTH",
    tagline: "",
  },
  {
    name: "JIGGER-WORTH STRAIGHT",
    tagline: "",
  },
  {
    name: "HYDRATION-WICK PARK",
    tagline: "",
  },
  {
    name: "BLOTTO PARK",
    tagline: "The home of virtual racing. Where every race is a reason to pour another.",
  },
  {
    name: "BOTTOMLESS-BURY",
    tagline: "",
  },
];

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
 * Returns all 12 card IDs for today (slots 0–11).
 * Slot 0 = 00:00, slot 1 = 02:00, … slot 11 = 22:00.
 * Always the full day's schedule regardless of current time.
 */
export function activeVirtualCardIds(_now = Date.now()): string[] {
  return Array.from({ length: TOTAL_DAILY_SLOTS }, (_, i) => cardIdForSlot(i));
}

/**
 * Returns the expected track name for a given virtual card ID.
 * Used to detect stale cards that need reseeding.
 */
export function expectedVenueName(cardId: string): string | null {
  const match = cardId.match(/^blotto-park-s(\d+)$/);
  if (!match) return null;
  const slotNum = parseInt(match[1], 10);
  return VENUES[slotNum % VENUES.length].name;
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
  const today = new Date().toISOString().slice(0, 10);

  const cardRef = doc(db, "cards", cardId);
  const cardDoc = await getDoc(cardRef);

  if (cardDoc.exists()) {
    // Already seeded for today — nothing to do
    if (cardDoc.data().raceDate === today) return;
    // Stale card from a previous day — wipe it and reseed fresh
    const staleBatch = writeBatch(db);
    staleBatch.delete(cardRef);
    for (let n = 1; n <= RACE_COUNT; n++) {
      const raceId = `${cardId}-r${n}`;
      staleBatch.delete(doc(db, "races", raceId));
      for (let h = 1; h <= HORSES_PER_RACE; h++) {
        staleBatch.delete(doc(db, "horses", `${raceId}-h${h}`));
      }
    }
    await staleBatch.commit();
  }

  const venue = VENUES[slotNum % VENUES.length];

  await setDoc(cardRef, {
    trackName: venue.name,
    tagline: venue.tagline,
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

  // One-time migration: hard-reset all virtual cards for the new venue rotation.
  // Deletes every isVirtual card plus its races and horses, then reseeds fresh.
  try {
    const resetMarker = await getDoc(doc(db, "_meta", "virtual-reset-v5"));
    if (!resetMarker.exists()) {
      await setDoc(doc(db, "_meta", "virtual-reset-v5"), { done: true });
      const allVirtual = await getDocs(
        query(collection(db, "cards"), where("isVirtual", "==", true))
      );
      // Delete each card's races and horses in its own batch (avoids 500-op limit)
      await Promise.all(allVirtual.docs.map(async (cardDoc) => {
        const cid = cardDoc.id;
        const batch = writeBatch(db);
        batch.delete(doc(db, "cards", cid));
        for (let n = 1; n <= 12; n++) {
          const raceId = `${cid}-r${n}`;
          batch.delete(doc(db, "races", raceId));
          for (let h = 1; h <= HORSES_PER_RACE; h++) {
            batch.delete(doc(db, "horses", `${raceId}-h${h}`));
          }
        }
        await batch.commit();
      }));
    }
  } catch { }

  // Legacy: remove old flat-ID cards
  try { await deleteDoc(doc(db, "cards", "virtual-park")); } catch { }
  try { await deleteDoc(doc(db, "cards", CARD_PREFIX)); } catch { }

  // Settle any finished races before seeding
  try { await settleVirtualRaces(); } catch { }

  // Seed all 12 daily slots in parallel (0 = 00:00 through 11 = 22:00)
  await Promise.all(
    Array.from({ length: TOTAL_DAILY_SLOTS }, (_, i) => seedSlot(i).catch(() => {}))
  );
}
