import { db } from "./firebase";
import {
  doc, getDoc, setDoc, getDocs, updateDoc, writeBatch,
  collection, query, where,
} from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MegaSlip = {
  id: string;
  name: string;
  joinCode: string;
  hostId: string;
  createdAt: string;
  cardIds: string[];
  scrumIds: string[];
};

export type MegaMember = {
  megaSlipId: string;
  userId: string;
  handle: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const genCode6 = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const genCode4 = () => Math.random().toString(36).slice(2, 6).toUpperCase();

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a Mega Slip with multiple tracks selected upfront.
 * Creates one scrum per card, auto-enrolls the host in all of them.
 * Returns the megaSlipId.
 */
export async function createMegaSlip(
  name: string,
  cards: { id: string; trackName: string }[],
  userId: string,
  handle: string,
): Promise<string> {
  const megaSlipId = crypto.randomUUID();
  const joinCode = genCode6();

  // Create one scrum per card
  const scrumIds: string[] = [];
  for (const card of cards) {
    const scrumId = crypto.randomUUID();
    await setDoc(doc(db, "scrums", scrumId), {
      cardId: card.id,
      hostId: userId,
      name,
      joinCode: genCode4(),   // each scrum gets its own 4-char code for direct access
      showDetails: false,
      megaSlipId,
    });
    scrumIds.push(scrumId);
  }

  // Write the mega slip master record
  await setDoc(doc(db, "megaSlips", megaSlipId), {
    name,
    joinCode,
    hostId: userId,
    createdAt: new Date().toISOString(),
    cardIds: cards.map(c => c.id),
    scrumIds,
  });

  // Enroll host in mega slip
  await setDoc(doc(db, "megaSlipMembers", `${megaSlipId}_${userId}`), {
    megaSlipId,
    userId,
    handle,
  });

  // Enroll host in every scrum
  const batch = writeBatch(db);
  scrumIds.forEach((scrumId) => {
    batch.set(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
      scrumId,
      userId,
      handle,
    });
  });
  await batch.commit();

  return megaSlipId;
}

// ── Join ──────────────────────────────────────────────────────────────────────

/**
 * Join a Mega Slip by its 6-char join code.
 * Enrolls the user in the mega slip and all existing track scrums.
 * Returns the megaSlipId.
 */
export async function joinMegaSlip(
  code: string,
  userId: string,
  handle: string,
): Promise<string> {
  const snap = await getDocs(
    query(collection(db, "megaSlips"), where("joinCode", "==", code.toUpperCase().trim()))
  );
  if (snap.empty) throw new Error("Code not found");

  const megaDoc = snap.docs[0];
  const megaSlipId = megaDoc.id;
  const { scrumIds } = megaDoc.data() as { scrumIds: string[] };

  // Enroll in mega slip
  await setDoc(doc(db, "megaSlipMembers", `${megaSlipId}_${userId}`), {
    megaSlipId,
    userId,
    handle,
  });

  // Enroll in all existing track scrums
  if (scrumIds.length > 0) {
    const batch = writeBatch(db);
    scrumIds.forEach((scrumId) => {
      batch.set(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId,
        userId,
        handle,
      });
    });
    await batch.commit();
  }

  return megaSlipId;
}

// ── Add track ─────────────────────────────────────────────────────────────────

/**
 * Add a new track to an existing Mega Slip (host only).
 * Creates a scrum for the card and auto-enrolls all current members.
 * Returns the new scrumId.
 */
export async function addTrackToMega(
  megaSlipId: string,
  card: { id: string; trackName: string },
  hostId: string,
  megaName: string,
): Promise<string> {
  const megaRef = doc(db, "megaSlips", megaSlipId);
  const megaDoc = await getDoc(megaRef);
  if (!megaDoc.exists()) throw new Error("Mega Slip not found");

  const { cardIds, scrumIds } = megaDoc.data() as { cardIds: string[]; scrumIds: string[] };

  // Guard: don't add the same track twice
  if (cardIds.includes(card.id)) throw new Error("Track already in this Mega Slip");

  // Create the new scrum
  const scrumId = crypto.randomUUID();
  await setDoc(doc(db, "scrums", scrumId), {
    cardId: card.id,
    hostId,
    name: megaName,
    joinCode: genCode4(),
    showDetails: false,
    megaSlipId,
  });

  // Update the mega slip arrays
  await updateDoc(megaRef, {
    cardIds: [...cardIds, card.id],
    scrumIds: [...scrumIds, scrumId],
  });

  // Enroll all current mega slip members in the new scrum
  const membersSnap = await getDocs(
    query(collection(db, "megaSlipMembers"), where("megaSlipId", "==", megaSlipId))
  );
  if (!membersSnap.empty) {
    const batch = writeBatch(db);
    membersSnap.docs.forEach((m) => {
      const { userId, handle } = m.data();
      batch.set(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId,
        userId,
        handle,
      });
    });
    await batch.commit();
  }

  return scrumId;
}

// ── Remove track ──────────────────────────────────────────────────────────────

/**
 * Remove a track from a Mega Slip (host only).
 * Removes from the mega slip arrays. The underlying scrum is kept
 * so existing picks and results are preserved.
 */
export async function removeTrackFromMega(
  megaSlipId: string,
  scrumId: string,
): Promise<void> {
  const megaRef = doc(db, "megaSlips", megaSlipId);
  const megaDoc = await getDoc(megaRef);
  if (!megaDoc.exists()) return;

  const { cardIds, scrumIds } = megaDoc.data() as { cardIds: string[]; scrumIds: string[] };
  const idx = scrumIds.indexOf(scrumId);
  if (idx === -1) return;

  const newCardIds = [...cardIds];
  const newScrumIds = [...scrumIds];
  newCardIds.splice(idx, 1);
  newScrumIds.splice(idx, 1);

  await updateDoc(megaRef, { cardIds: newCardIds, scrumIds: newScrumIds });
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

export async function getMegaSlip(megaSlipId: string): Promise<MegaSlip | null> {
  const d = await getDoc(doc(db, "megaSlips", megaSlipId));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as MegaSlip;
}

export async function getMegaSlipsForUser(userId: string): Promise<MegaSlip[]> {
  const membersSnap = await getDocs(
    query(collection(db, "megaSlipMembers"), where("userId", "==", userId))
  );
  if (membersSnap.empty) return [];
  const megaDocs = await Promise.all(
    membersSnap.docs.map(m => getDoc(doc(db, "megaSlips", m.data().megaSlipId)))
  );
  return megaDocs
    .filter(d => d.exists())
    .map(d => ({ id: d.id, ...d.data() }) as MegaSlip);
}
