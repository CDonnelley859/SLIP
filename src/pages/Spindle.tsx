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

      <main className="pt-8 pb-16">
        {loading ? (
          <p className="text-label-caps uppercase text-muted-foreground text-center pt-10">Loading…</p>
        ) : slips.length === 0 ? (
          <div className="mx-4 border-brutalist p-8 text-center">
            <p className="text-body-md text-muted-foreground">No completed slips yet.</p>
            <p className="text-label-caps text-muted-foreground uppercase mt-2">
              Finish a Daily Gallop to see it here.
            </p>
          </div>
        ) : (
          <>
            {/* Carousel */}
            <div className="flex overflow-x-auto snap-x snap-mandatory -mx-0 gap-4 px-4 scroll-px-4 pb-4" style={{ scrollbarWidth: "none" }}>
              {slips.map((s) => (
                <Link
                  key={s.scrumId}
                  to={`/scrum/${s.scrumId}/slip`}
                  className="flex-shrink-0 w-[calc(100vw-2rem)] snap-center border-brutalist bg-white overflow-hidden block"
                >
                  {/* Ticket header */}
                  <div className="p-6 pb-4 border-b-[2.67px] border-dashed border-primary">
                    <span className="text-label-caps text-muted-foreground uppercase block">{s.date}</span>
                    <span className="text-headline-lg uppercase leading-tight block mt-1">{s.trackName}</span>
                    <span className="text-label-caps text-muted-foreground uppercase block mt-1">{s.scrumName}</span>
                  </div>

                  {/* Score block */}
                  <div className="p-6 flex justify-between items-end">
                    <div>
                      <span className="text-label-caps text-muted-foreground uppercase block">YOUR SCORE</span>
                      <span className="text-[56px] font-black leading-none">{s.totalPoints}</span>
                      <span className="text-label-caps text-muted-foreground uppercase block">PTS</span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      {s.rank && (
                        <div className="text-right">
                          <span className="text-label-caps text-muted-foreground uppercase block">RANK</span>
                          <span className="text-headline-md font-black">#{s.rank} <span className="text-label-caps font-normal text-muted-foreground">OF {s.totalMembers}</span></span>
                        </div>
                      )}
                      <div className="text-label-caps border-brutalist px-2 py-1 uppercase">SETTLED ✓</div>
                    </div>
                  </div>

                  {/* Tap prompt */}
                  <div className="px-6 pb-5">
                    <span className="text-label-caps text-muted-foreground uppercase underline underline-offset-2">TAP TO VIEW SLIP →</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Dot indicators */}
            {slips.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-2">
                {slips.map((s, i) => (
                  <div key={s.scrumId} className="w-1.5 h-1.5 rounded-full bg-primary opacity-30" />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Spindle;
