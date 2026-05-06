import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";
import { motion } from "framer-motion";

const Slip = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const { data: s } = await supabase.from("scrums").select("*, cards(*)").eq("id", id).maybeSingle();
      setScrum(s);
      const { data } = await supabase
        .from("picks")
        .select("points, horse:horses(number, name), race:races(race_number, status, winners)")
        .eq("scrum_id", id)
        .eq("user_id", user.id);
      setLines((data ?? []).sort((a: any, b: any) => a.race.race_number - b.race.race_number));
    };
    load();
    const ch = supabase
      .channel(`slip-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "races" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "picks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const total = lines.reduce((sum, l) => sum + (l.points ?? 0), 0);

  return (
    <PageShell title="Official Slip">
      <motion.div
        initial={{ scaleY: 0, originY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="slip-paper rounded-sm p-6 font-mono"
      >
        <div className="text-center border-b-2 border-dashed border-paper-ink/30 pb-3 mb-4">
          <div className="font-display font-black text-2xl tracking-tight">SLIP</div>
          <div className="text-xs uppercase tracking-widest opacity-70">{scrum?.cards?.track_name}</div>
          <div className="text-xs opacity-60">{scrum?.name}</div>
        </div>
        <div className="space-y-2 text-sm">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between">
              <span>R{l.race?.race_number} · #{l.horse?.number} {l.horse?.name}</span>
              <span className="font-bold">
                {l.race?.status === "settled" ? `${l.points ?? 0} pt` : "—"}
              </span>
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
