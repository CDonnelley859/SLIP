import { db } from "./firebase";
import {
  doc, getDoc, setDoc, getDocs, writeBatch, deleteDoc,
  collection, query, where, updateDoc,
} from "firebase/firestore";

const CARD_ID = "blotto-park";
const RACE_COUNT = 8;
const HORSES_PER_RACE = 8;
const RACE_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours between races

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

/** Settle any finished races in the current Blotto Park card. Safe to call at any time. */
async function settleFinishedRaces(): Promise<void> {
  const now = Date.now();
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
}

/**
 * Call on every page load to settle any Blotto Park races whose off-time has passed.
 * Lightweight — skips races already marked settled.
 */
export async function settleVirtualRaces(): Promise<void> {
  try { await settleFinishedRaces(); } catch { }
}

/**
 * Seeds or resets the Blotto Park test track.
 * Safe to call multiple times — skips if the card is still fresh.
 */
export async function seedVirtualTrack(): Promise<void> {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // One-time migration: remove old "virtual-park" card if it still exists
  try { await deleteDoc(doc(db, "cards", "virtual-park")); } catch { }

  // Settle any finished races in the current cycle before checking freshness
  await settleFinishedRaces();

  // Check if the existing card is still fresh
  const cardRef = doc(db, "cards", CARD_ID);
  const cardDoc = await getDoc(cardRef);
  if (cardDoc.exists()) {
    const postTime = new Date(cardDoc.data().postTime).getTime();
    const lastRaceTime = postTime + (RACE_COUNT - 1) * RACE_GAP_MS;
    if (now < lastRaceTime + 5 * 60 * 1000) return; // still running or just finished
  }

  // Write new virtual card
  // Anchor to 10:00 AM — races run every 2 h landing on the hour: 10, 12, 14, 16, 18, 20, 22, 00
  const tenAM = new Date();
  tenAM.setHours(10, 0, 0, 0);
  if (tenAM.getTime() <= now) tenAM.setDate(tenAM.getDate() + 1); // already past today's 10 AM
  const firstRaceTime = tenAM.getTime();
  const firstRaceISO = new Date(firstRaceTime).toISOString();

  await setDoc(cardRef, {
    trackName: "BLOTTO PARK",
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
