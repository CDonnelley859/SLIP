import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";

const Stalls = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [horseCount, setHorseCount] = useState(0);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: s } = await supabase
        .from("scrums")
        .select("*, cards(*)")
        .eq("id", id)
        .maybeSingle();
      setScrum(s);
      const { data: m } = await supabase
        .from("scrum_members")
        .select("user_id, profiles(handle, cap_color)")
        .eq("scrum_id", id);
      setMembers(m ?? []);
      if (s?.card_id) {
        const { data: races } = await supabase.from("races").select("id").eq("card_id", s.card_id);
        if (races?.length) {
          const { count } = await supabase
            .from("horses")
            .select("*", { count: "exact", head: true })
            .in("race_id", races.map((r: any) => r.id));
          setHorseCount(count ?? 0);
        }
      }
    })();
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <PageShell title="The Stalls">
      {scrum && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{scrum.cards?.track_name}</div>
            <h2 className="font-display text-2xl mt-1">{scrum.name}</h2>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-xs text-muted-foreground">Join code</div>
                <div className="font-mono brass-text text-xl tracking-widest">{scrum.join_code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Post Time</div>
                <div className="font-mono text-sm">
                  {scrum.cards?.post_time && formatDistanceToNow(new Date(scrum.cards.post_time), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Lineup ({members.length})</div>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 bg-card rounded-full pl-1 pr-3 py-1 border border-border">
                  <div className="h-6 w-6 rounded-full" style={{ background: m.profiles?.cap_color ?? "#c9a84c" }} />
                  <span className="text-sm">@{m.profiles?.handle}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">{horseCount} horses across the card</div>

          <Link to={`/scrum/${id}/gallop`}>
            <Button className="w-full font-display text-lg" size="lg">Enter the Daily Gallop</Button>
          </Link>
        </div>
      )}
    </PageShell>
  );
};
export default Stalls;
