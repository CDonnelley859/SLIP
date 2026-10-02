import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, type DocumentData } from "firebase/firestore";

export type StatSummary = {
  gamesPlayed: number;
  totalPoints: number;
  bestScore: number;
  wins: number;
  places: number;
  shows: number;
  bestRank: number | null;
  avgPoints: number;
};

export const EMPTY_STATS: StatSummary = {
  gamesPlayed: 0, totalPoints: 0, bestScore: 0, wins: 0, places: 0, shows: 0, bestRank: null, avgPoints: 0,
};

/**
 * Aggregate a user's results across every group they play in.
 * `scrumFilter` lets callers restrict to a subset (e.g. one crew).
 */
export async function computeUserStats(
  userId: string,
  scrumFilter?: (scrum: DocumentData) => boolean,
): Promise<StatSummary> {
  const membersSnap = await getDocs(
    query(collection(db, "scrumMembers"), where("userId", "==", userId))
  );

  const results = await Promise.all(membersSnap.docs.map(async (m) => {
    const scrumId = m.data().scrumId;
    const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
    if (!scrumDoc.exists()) return null;
    if (scrumFilter && !scrumFilter(scrumDoc.data())) return null;

    const allPicksSnap = await getDocs(query(collection(db, "picks"), where("scrumId", "==", scrumId)));
    const myPicks = allPicksSnap.docs.filter(p => p.data().userId === userId);
    if (myPicks.length === 0) return null;

    const myTotal = myPicks.reduce((s, p) => s + (p.data().points ?? 0), 0);
    const wins = myPicks.filter(p => p.data().points === 5).length;
    const places = myPicks.filter(p => p.data().points === 3).length;
    const shows = myPicks.filter(p => p.data().points === 1).length;

    const pointsByUser: Record<string, number> = {};
    allPicksSnap.docs.forEach(p => {
      const uid = p.data().userId;
      pointsByUser[uid] = (pointsByUser[uid] ?? 0) + (p.data().points ?? 0);
    });
    const sorted = Object.values(pointsByUser).sort((a, b) => b - a);
    const rank = sorted.indexOf(myTotal) + 1;
    return { myTotal, wins, places, shows, rank, members: sorted.length };
  }));

  const valid = results.filter(Boolean) as NonNullable<typeof results[0]>[];
  if (valid.length === 0) return { ...EMPTY_STATS };

  const rankedGames = valid.filter(r => r.members > 1);
  const totalPoints = valid.reduce((s, r) => s + r.myTotal, 0);
  return {
    gamesPlayed: valid.length,
    totalPoints,
    bestScore: Math.max(...valid.map(r => r.myTotal)),
    wins: valid.reduce((s, r) => s + r.wins, 0),
    places: valid.reduce((s, r) => s + r.places, 0),
    shows: valid.reduce((s, r) => s + r.shows, 0),
    bestRank: rankedGames.length > 0 ? Math.min(...rankedGames.map(r => r.rank)) : null,
    avgPoints: Math.round(totalPoints / valid.length),
  };
}
