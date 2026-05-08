import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
} from "firebase/firestore";

type LineStatus = "WIN" | "PLACE" | "SHOW" | "OUT";
type Line = {
  raceNumber: number;
  horseName: string;
  horseNumber: number;
  offTime: string | null;
  status: LineStatus;
  points: number;
  podium: {
    first: { number: number; name: string } | null;
    second: { number: number; name: string } | null;
    third: { number: number; name: string } | null;
  };
};

type CompletedSlip = {
  scrumId: string;
  scrumName: string;
  trackName: string;
  date: string;
  totalPoints: number;
  rank: number | null;
  totalMembers: number;
  lines: Line[];
};

function statusFor(winners: any, horseId: string): LineStatus {
  if (!winners) return "OUT";
  if (winners.first === horseId) return "WIN";
  if (winners.second === horseId) return "PLACE";
  if (winners.third === horseId) return "SHOW";
  return "OUT";
}

function pointsFor(status: LineStatus): number {
  if (status === "WIN") return 5;
  if (status === "PLACE") return 3;
  if (status === "SHOW") return 1;
  return 0;
}

const StatusBadge = ({ status }: { status: LineStatus }) => {
  if (status === "WIN") return <div className="text-headline-md uppercase stamp-win">WIN</div>;
  if (status === "PLACE") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-8deg)" }}>PLACE</div>
  );
  if (status === "SHOW") return (
    <div className="text-headline-md uppercase stamp-win" style={{ transform: "rotate(-6deg)" }}>SHOW</div>
  );
  return <div className="text-label-caps text-muted-foreground">OUT</div>;
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

      const today = new Date().toISOString().slice(0, 10);
      const completed: CompletedSlip[] = [];

      for (const m of membersSnap.docs) {
        const scrumId = m.data().scrumId;
        const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
        if (!scrumDoc.exists()) continue;
        const scrum = scrumDoc.data();

        const cardDoc = await getDoc(doc(db, "cards", scrum.cardId));
        const cardData = cardDoc.data();

        // Show previous-day games always; today's games only once fully settled
        const isPreviousDay = cardData?.raceDate && cardData.raceDate < today;
        if (!isPreviousDay) {
          const racesSnap = await getDocs(
            query(collection(db, "races"), where("cardId", "==", scrum.cardId))
          );
          const total = racesSnap.size;
          const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
          if (total === 0 || settled < total) continue;
        }

        // Build full lines for this slip
        const myPicksSnap = await getDocs(
          query(collection(db, "picks"),
            where("scrumId", "==", scrumId),
            where("userId", "==", userId))
        );

        const lines: Line[] = [];
        for (const pickDoc of myPicksSnap.docs) {
          const pick = pickDoc.data();
          const raceDoc = await getDoc(doc(db, "races", pick.raceId));
          const horseDoc = await getDoc(doc(db, "horses", pick.horseId));
          const race = raceDoc.data();
          const horse = horseDoc.data();
          const winners = race?.winners;
          const status = statusFor(winners, pick.horseId);

          const fetchWinner = async (horseId: string | undefined) => {
            if (!horseId) return null;
            const d = await getDoc(doc(db, "horses", horseId));
            if (!d.exists()) return null;
            return { number: d.data().number, name: d.data().name };
          };

          lines.push({
            raceNumber: race?.raceNumber ?? 0,
            horseName: horse?.name ?? "—",
            horseNumber: horse?.number ?? 0,
            offTime: race?.offTime ?? null,
            status,
            points: pointsFor(status),
            podium: {
              first: await fetchWinner(winners?.first),
              second: await fetchWinner(winners?.second),
              third: await fetchWinner(winners?.third),
            },
          });
        }

        lines.sort((a, b) => a.raceNumber - b.raceNumber);
        const totalPoints = lines.reduce((a, l) => a + l.points, 0);

        // Rank
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
          lines,
        });
      }

      setSlips(completed.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    })();
  }, [userId]);

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
            <div
              className="flex overflow-x-auto snap-x snap-mandatory pb-4"
              style={{ scrollbarWidth: "none" }}
            >
              {slips.map((s) => (
                <div
                  key={s.scrumId}
                  className="flex-shrink-0 w-screen snap-center flex justify-center px-4"
                >
                  {/* Full ticket */}
                  <div className="relative w-full max-w-md bg-white border-brutalist ticket-clip overflow-hidden">
                    {/* Punch holes */}
                    <div style={{
                      position: "absolute", left: -10, top: "20%",
                      width: 20, height: 20, background: "#f9f9f9",
                      borderRadius: "50%", borderRight: "2.67px solid black", zIndex: 10,
                    }} />
                    <div style={{
                      position: "absolute", right: -10, top: "20%",
                      width: 20, height: 20, background: "#f9f9f9",
                      borderRadius: "50%", borderLeft: "2.67px solid black", zIndex: 10,
                    }} />

                    {/* ── STUB ── */}
                    <div className="p-6 pt-8 border-b-[2.67px] border-dashed border-primary">
                      <div className="flex flex-col items-center gap-1 mb-5">
                        <span className="text-headline-lg uppercase text-center leading-tight">{s.trackName}</span>
                        <span className="text-label-caps text-muted-foreground uppercase">{s.scrumName}</span>
                        {s.date && (
                          <span className="text-label-caps text-muted-foreground">
                            {new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-end border-t border-primary/20 pt-4">
                        <div>
                          <span className="text-label-caps text-muted-foreground uppercase block">TOTAL</span>
                          <span className="text-[40px] font-black leading-none">{s.totalPoints}</span>
                          <span className="text-label-caps text-muted-foreground uppercase"> PTS</span>
                        </div>
                        {s.rank && (
                          <div className="text-right">
                            <span className="text-label-caps text-muted-foreground uppercase block">RANK</span>
                            <span className="text-headline-md font-black">#{s.rank}</span>
                            <span className="text-label-caps text-muted-foreground"> OF {s.totalMembers}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── BODY ── Lines */}
                    <div className="p-6 space-y-4">
                      {s.lines.map((l, i) => {
                        const isOut = l.status === "OUT";
                        const isSettled = l.status === "WIN" || l.status === "PLACE" || l.status === "SHOW";
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 border-b border-primary/10 pb-3 last:border-0 ${isOut ? "opacity-50" : ""}`}
                          >
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-label-caps text-muted-foreground">
                                RACE {String(l.raceNumber).padStart(2, "0")}
                                {l.offTime && ` · ${new Date(l.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              </span>
                              <span className={`text-body-lg ${isOut ? "line-through" : ""}`}>
                                {l.horseNumber}. {l.horseName}
                              </span>
                              <span className={`text-label-caps mt-1 ${isSettled ? "text-primary" : "text-muted-foreground"}`}>
                                {isOut ? "+0 PTS" : `+${l.points} PTS`}
                              </span>
                              <div className="flex gap-2 mt-2">
                                {(["first", "second", "third"] as const).map((pos, pi) => {
                                  const horse = l.podium[pos];
                                  const label = ["1ST", "2ND", "3RD"][pi];
                                  return (
                                    <div key={pos} className="flex-1 border border-primary/30 p-1 text-center">
                                      <div className="text-[9px] text-muted-foreground font-mono uppercase">{label}</div>
                                      <div className="text-[11px] font-bold uppercase leading-tight mt-0.5 truncate">
                                        {horse ? `${horse.number}. ${horse.name}` : "—"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="shrink-0 pt-1 pr-1">
                              <StatusBadge status={l.status} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom padding */}
                    <div className="pb-2" />
                  </div>
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            {slips.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {slips.map((s) => (
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
