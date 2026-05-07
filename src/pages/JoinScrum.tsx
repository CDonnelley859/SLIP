import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const JoinScrum = () => {
  const { userId } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: scrum, error } = await supabase
        .from("scrums")
        .select("id")
        .eq("join_code", code.toUpperCase().trim())
        .single();

      if (error || !scrum) throw new Error("Code not found");

      await supabase.from("scrum_members").upsert({
        scrum_id: scrum.id,
        user_id: userId,
      });

      navigate(`/scrum/${scrum.id}/gallop`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b-brutalist flex items-center h-16 px-4 sticky top-0 z-50">
        <button
          onClick={() => navigate("/")}
          className="text-label-caps uppercase mr-4 hover:underline"
        >
          ← BACK
        </button>
        <h1 className="text-body-lg uppercase">Join Group</h1>
      </header>

      <main className="px-4 pt-6 max-w-sm">
        <form onSubmit={join}>
          <div className="relative border-brutalist">
            <label className="absolute top-[-9px] left-3 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              GROUP_CODE
            </label>
            <input
              autoFocus
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full bg-transparent px-4 py-4 text-data-mono uppercase placeholder:text-muted-foreground/40 focus:outline-none font-mono tracking-widest text-center"
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist border-t-0 disabled:opacity-40 transition-none"
          >
            {busy ? "JOINING…" : "JOIN"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default JoinScrum;
