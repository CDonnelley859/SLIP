import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Race = { id: string; race_number: number; name: string | null; off_time: string; horses: Horse[] };
type Horse = { id: string; number: number; name: string; jockey: string | null; odds: string | null };

const Gallop = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({}); // race_id -> horse_id
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: s } = await supabase.from("scrums").select("*, cards(*)").eq("id", id).maybeSingle();
      setScrum(s);
      if (!s?.card_id) return;
      const { data: r } = await supabase
        .from("races")
        .select("id, race_number, name, off_time, horses(id, number, name, jockey, odds)")
        .eq("card_id", s.card_id)
        .order("race_number");
      setRaces((r ?? []) as any);

      const { data: existing } = await supabase
        .from("picks")
        .select("race_id, horse_id")
        .eq("scrum_id", id)
        .eq("user_id", user.id);
      const map: Record<string, string> = {};
      (existing ?? []).forEach((p: any) => (map[p.race_id] = p.horse_id));
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
      const rows = Object.entries(picks).map(([race_id, horse_id]) => ({
        scrum_id: id!,
        user_id: user.id,
        race_id,
        horse_id,
      }));
      const { error } = await supabase
        .from("picks")
        .upsert(rows, { onConflict: "scrum_id,user_id,race_id" });
      if (error) throw error;
      navigate(`/scrum/${id}/slip`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Daily Gallop" back={`/scrum/${id}/stalls`}>
      <div className="text-xs text-muted-foreground mb-4">{scrum?.cards?.track_name} · ink one horse per race</div>
      <div className="space-y-6">
        {races.map((r) => (
          <div key={r.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 border-b border-border flex justify-between items-baseline">
              <div className="font-display text-lg">Race {r.race_number}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {new Date(r.off_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="divide-y divide-border">
              {r.horses?.sort((a, b) => a.number - b.number).map((h) => {
                const selected = picks[r.id] === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [r.id]: h.id }))}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition relative ${
                      selected ? "bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <span className="font-mono w-6 text-center brass-text">{h.number}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{h.name}</div>
                      {h.jockey && <div className="text-xs text-muted-foreground">{h.jockey}</div>}
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{h.odds}</span>
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-primary text-5xl font-display opacity-30">
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
