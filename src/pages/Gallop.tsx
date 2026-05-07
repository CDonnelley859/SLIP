import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from "firebase/firestore";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Horse = { id: string; number: number; name: string; jockey: string | null; odds: string | null };
type Race = { id: string; raceNumber: number; name: string | null; offTime: string; horses: Horse[] };

const Gallop = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [card, setCard] = useState<any>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const scrumSnap = await getDoc(doc(db, "scrums", id));
      if (!scrumSnap.exists()) return;
      const scrumData = scrumSnap.data();

      const cardSnap = await getDoc(doc(db, "cards", scrumData.cardId));
      if (cardSnap.exists()) setCard(cardSnap.data());

      const racesSnap = await getDocs(collection(db, "cards", scrumData.cardId, "races"));
      const raceList: Race[] = [];
      for (const r of racesSnap.docs) {
        const horsesSnap = await getDocs(collection(db, "cards", scrumData.cardId, "races", r.id, "horses"));
        const horses = horsesSnap.docs.map(h => ({ id: h.id, ...h.data() } as Horse)).sort((a, b) => a.number - b.number);
        raceList.push({ id: r.id, ...r.data(), horses } as Race);
      }
      setRaces(raceList.sort((a, b) => a.raceNumber - b.raceNumber));

      const picksSnap = await getDocs(collection(db, "scrums", id, "picks"));
      const map: Record<string, string> = {};
      picksSnap.docs.filter(p => p.data().userId === user.uid).forEach(p => {
        map[p.data().raceId] = p.data().horseId;
      });
      setPicks(map);
    })();
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const submit = async () => {
    if (Object.keys(picks).length !== races.length) {
      toast.error("Pick a horse in every race");
      return;
    }
    setBusy(true);
    try {
      for (const [raceId, horseId] of Object.entries(picks)) {
        const pickId = `${user.uid}_${raceId}`;
        await setDoc(doc(db, "scrums", id!, "picks", pickId), {
          scrumId: id,
          userId: user.uid,
          raceId,
          horseId,
          points: null,
          createdAt: serverTimestamp(),
        });
      }
      navigate(`/scrum/${id}/slip`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Daily Gallop" back={`/scrum/${id}/stalls`}>
      <div className="text-xs text-muted-foreground mb-4">
        {card?.trackName} · ink one horse per race
      </div>
      <div className="space-y-6">
        {races.map((r) => {
          const isLocked = new Date(r.offTime).getTime() <= Date.now();
          return (
            <div key={r.id} className={`bg-card rounded-lg border border-border overflow-hidden ${isLocked ? "opacity-60" : ""}`}>
              <div className="px-4 py-2 border-b border-border flex justify-between items-baseline">
                <div className="font-display text-lg">Race {r.raceNumber}{r.name ? ` · ${r.name}` : ""}</div>
                <div className="flex items-center gap-2">
                  {isLocked && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Locked</span>}
                  <div className="text-xs text-muted-foreground font-mono">
                    {new Date(r.offTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {r.horses.map((h) => {
                  const selected = picks[r.id] === h.id;
                  return (
                    <button key={h.id} type="button" disabled={isLocked}
                      onClick={() => !isLocked && setPicks((p) => ({ ...p, [r.id]: h.id }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition relative
                        ${selected ? "bg-primary/10" : "hover:bg-muted/30"}
                        ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className="font-mono w-6 text-center brass-text">{h.number}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{h.name}</div>
                        {h.jockey && <div className="text-xs text-muted-foreground">{h.jockey}</div>}
                      </div>
                      <span className="font-mono text-sm text-muted-foreground">{h.odds}</span>
                      {selected && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-primary text-5xl font-display opacity-30">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/95 backdrop-blur border-t border-border mt-6">
        <Button onClick={submit} disabled={busy} className="w-full font-display" size="lg">
          Validate Slip ({Object.keys(picks).length}/{races.length})
        </Button>
      </div>
    </PageShell>
  );
};

export default Gallop;
