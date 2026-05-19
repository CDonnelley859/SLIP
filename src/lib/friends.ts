import { db } from "@/lib/firebase";
import {
  collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

export type Friend = {
  userId: string;
  friendUserId: string;
  friendHandle: string;
};

export async function addFriend(
  userId: string,
  friendUserId: string,
  friendHandle: string,
): Promise<void> {
  await setDoc(doc(db, "friends", `${userId}_${friendUserId}`), {
    userId,
    friendUserId,
    friendHandle,
    addedAt: serverTimestamp(),
  });
}

export async function getFriends(userId: string): Promise<Friend[]> {
  const snap = await getDocs(
    query(collection(db, "friends"), where("userId", "==", userId))
  );
  return snap.docs.map(d => ({
    userId: d.data().userId as string,
    friendUserId: d.data().friendUserId as string,
    friendHandle: d.data().friendHandle as string,
  }));
}

export async function removeFriend(userId: string, friendUserId: string): Promise<void> {
  await deleteDoc(doc(db, "friends", `${userId}_${friendUserId}`));
}
