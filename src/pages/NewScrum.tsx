import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const NewScrum = () => {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const cardId = params.get("card");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!cardId) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const join_code = code();
      const { data: scrum, error } = await supabase
        .from("scrums")
        .insert({ card_id: cardId, host_id: user.id, name, join_code })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("scrum_members").insert({ scrum_id: scrum.id, user_id: user.id });
      toast.success(`Scrum created · code ${join_code}`);
      navigate(`/scrum/${scrum.id}/stalls`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="New Scrum">
      <form onSubmit={create} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="name">Scrum name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="The Saturday Crew" />
        </div>
        <Button type="submit" disabled={busy} className="w-full">Create Scrum</Button>
      </form>
    </PageShell>
  );
};
export default NewScrum;
