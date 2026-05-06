import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const JoinScrum = () => {
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: scrum, error } = await supabase
        .from("scrums")
        .select("id")
        .eq("join_code", code.toUpperCase().trim())
        .maybeSingle();
      if (error) throw error;
      if (!scrum) throw new Error("Code not found");
      const { error: mErr } = await supabase
        .from("scrum_members")
        .insert({ scrum_id: scrum.id, user_id: user.id });
      if (mErr && !mErr.message.includes("duplicate")) throw mErr;
      navigate(`/scrum/${scrum.id}/stalls`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Join Scrum">
      <form onSubmit={join} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="code">Join code</Label>
          <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase tracking-widest text-lg" maxLength={6} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">Join</Button>
      </form>
    </PageShell>
  );
};
export default JoinScrum;
