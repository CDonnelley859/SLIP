import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
} from "firebase/firestore";

type CompletedSlip = {
  scrumId: string; scrumName: string; trackName: string;
  date: string; totalPoints: number; rank: number | null; totalMembers: number;
};

const Spindle = () => {
  const { userId } = useAuth();
  const [slips, setSlips] = useState<CompletedSlip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("userId", "==", userId))
      );

      const completed: CompletedSlip[] = [];

      for (const m of membersSnap.docs) {
        const scrumId = m.data().scrumId;
        const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumDoc.exists()) continue;
        const scrum = scrumDoc.data();

        const racesSnap = await getDocs(
          query(collection(db, "races"), where("cardId", "==", scrum.cardId))
        );
        const total = racesSnap.size;
        const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
        if (total === 0 || settled < total) continue;

        const cardDoc = await getDoc(doc(db, "cards", scrum.cardId));
        const cardData = cardDoc.data();

        const myPicksSnap = await getDocs(
          query(collection(db, "picks"),
            where("scrumId", "==", scrumId),
            where("userId", "==", userId))
        );
        const totalPoints = myPicksSnap.docs.reduce((a, p) => a + (p.data().points ?? 0), 0);

        const allPicksSnap = await getDocs(
          query(collection(db, "picks"), where("scrumId", "==", scrumId))
        );
        const pointsByUser: Record<string, number> = {};
        allPicksSnap.docs.forEach(p => {
          const uid = p.data().userId;
          pointsByUser[uid] = (pointsByUser[uid] ?? 0) + (p.data().points ?? 0);
        });
        const sorted = Object.values(pointsByUser).sort((a, b) => b - a);
        const rank = sorted.indexOf(totalPoints) + 1;

        completed.push({
          scrumId,
          scrumName: scrum.name,
          trackName: cardData?.trackName ?? "—",
          date: cardData?.raceDate ?? "",
          totalPoints,
          rank,
          totalMembers: sorted.length,
        });
      }

      setSlips(completed.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b-brutalist flex items-center justify-between h-16 px-4 sticky top-0 z-50">
        <Link to="/" className="text-label-caps uppercase hover:underline">← PADDOCK</Link>
        <h1 className="text-headline-md uppercase">THE SPINDLE</h1>
        <div className="w-20" />
      </header>

      <main className="px-4 pt-6 pb-16">
        {loading ? (
          <p className="text-label-caps uppercase text-muted-foreground text-center pt-10">Loading…</p>
        ) : slips.length === 0 ? (
          <div className="border-brutalist p-8 text-center">
            <p className="text-body-md text-muted-foreground">No completed slips yet.</p>
            <p className="text-label-caps text-muted-foreground uppercase mt-2">
              Finish a Daily Gallop to see it here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {slips.map((s, i) => (
              <Link
                key={s.scrumId}
                to={`/scrum/${s.scrumId}/slip`}
                className={`border-brutalist p-4 bg-background flex justify-between items-start ${i > 0 ? "mt-[-2.67px]" : ""}`}
              >
                <div>
                  <span className="text-label-caps text-muted-foreground uppercase block">VENUE</span>
                  <span className="text-headline-md uppercase">{s.trackName}</span>
                  <div className="mt-1">
                    <span className="text-label-caps text-muted-foreground uppercase block">GROUP</span>
                    <span className="text-body-md font-bold uppercase">{s.scrumName}</span>
                  </div>
                  <span className="text-label-caps text-muted-foreground uppercase block mt-2">{s.date}</span>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-headline-lg font-black">{s.totalPoints}</span>
                  <span className="text-label-caps text-muted-foreground">PTS</span>
                  {s.rank && (
                    <span className="text-label-caps text-muted-foreground">
                      #{s.rank} OF {s.totalMembers}
                    </span>
                  )}
                  <div className="text-label-caps border-brutalist px-2 py-1 mt-1 uppercase">SETTLED</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Spindle;
