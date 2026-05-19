import { db } from "@/lib/firebase";
import {
  collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

export type CrewMember = { userId: string; handle: string };

export type Crew = {
  id: string;
  name: string;
  createdBy: string;
  members: CrewMember[];
};

export async function saveCrew(
  name: string,
  members: CrewMember[],
  createdBy: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await setDoc(doc(db, "crews", id), {
    name,
    createdBy,
    members,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function getCrewsForUser(userId: string): Promise<Crew[]> {
  const snap = await getDocs(
    query(collection(db, "crews"), where("createdBy", "==", userId))
  );
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name as string,
    createdBy: d.data().createdBy as string,
    members: (d.data().members ?? []) as CrewMember[],
  }));
}

export async function deleteCrew(crewId: string): Promise<void> {
  await deleteDoc(doc(db, "crews", crewId));
}
