import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { PageShell } from "@/components/PageShell";
import { syncResults } from "@/lib/racingApi";
import { toast } from "sonner";
import { motion } from "framer-motion";

type Line = { raceNumber: number; horseName: string; horseNumber: number; status: string; points: number | null };

const Slip = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | null = null;

    (async () => {
      const scrumSnap = await getDoc(doc(db, "scrums", id));
      if (!scrumSnap.exists()) return;
      const scrumData = scrumSnap.data();
      setScrum(scrumData);

      const cardSnap = await getDoc(doc(db, "cards", scrumData.cardId));
      if (cardSnap.exists()) setCard(cardSnap.data());

      const picksQ = query(collection(db, "scrums", id, "picks"), where("userId", "==", userId));
      unsub = onSnapshot(picksQ, async (snap) => {
        const built: Line[] = [];
        for (const p of snap.docs) {
          const pick = p.data();
          const [raceSnap, horseSnap] = await Promise.all([
            getDoc(doc(db, "cards", scrumData.cardId, "races", pick.raceId)),
            getDoc(doc(db, "cards", scrumData.cardId, "races", pick.raceId, "horses", pick.horseId)),
          ]);
          if (!raceSnap.exists() || !horseSnap.exists()) continue;
          built.push({
            raceNumber: raceSnap.data().raceNumber,
            horseName: horseSnap.data().name,
            horseNumber: horseSnap.data().number,
            status: raceSnap.data().status,
            points: pick.points ?? null,
          });
        }
        setLines(built.sort((a, b) => a.raceNumber - b.raceNumber));
      });
    })();

    return () => { unsub?.(); };
  }, [id]);

  const total = lines.reduce((sum, l) => sum + (l.points ?? 0), 0);

  async function handleRefresh() {
    if (!scrum?.cardId) return;
    toast.loading("Pulling results…", { id: "r" });
    try {
      await syncResults(scrum.cardId);
      toast.success("Results updated", { id: "r" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed", { id: "r" });
    }
  }

  return (
    <PageShell title="Official Slip">
      <button onClick={handleRefresh} className="text-xs text-primary hover:underline mb-3">
        Refresh results
      </button>
      <motion.div
        initial={{ scaleY: 0, originY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="slip-paper rounded-sm p-6 font-mono"
      >
        <div className="text-center border-b-2 border-dashed border-paper-ink/30 pb-3 mb-4">
          <div className="font-display font-black text-2xl tracking-tight">SLIP</div>
          <div className="text-xs uppercase tracking-widest opacity-70">{card?.trackName}</div>
          <div className="text-xs opacity-60">{scrum?.name}</div>
        </div>
        <div className="space-y-2 text-sm">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between">
              <span>R{l.raceNumber} · #{l.horseNumber} {l.horseName}</span>
              <span className="font-bold">{l.status === "settled" ? `${l.points ?? 0} pt` : "—"}</span>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-dashed border-paper-ink/30 mt-4 pt-3 flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{total} pts</span>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default Slip;
