import { db } from "./firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I lookalikes

function randomCode(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

/** Generate a join code of exactly `len` chars that no doc in `coll` already uses. */
export async function uniqueJoinCode(coll: "scrums" | "megaSlips", len: number): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode(len);
    const snap = await getDocs(query(collection(db, coll), where("joinCode", "==", code), limit(1)));
    if (snap.empty) return code;
  }
  return randomCode(len);
}
