import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
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
      const snap = await getDocs(query(collection(db, "scrums"), where("joinCode", "==", code.toUpperCase().trim())));
      if (snap.empty) throw new Error("Code not found");
      const scrumId = snap.docs[0].id;
      await setDoc(doc(db, "scrums", scrumId, "members", user.uid), {
        userId: user.uid,
        joinedAt: serverTimestamp(),
      });
      navigate(`/scrum/${scrumId}/stalls`);
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
          <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)}
            className="font-mono uppercase tracking-widest text-lg" maxLength={6} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">Join</Button>
      </form>
    </PageShell>
  );
};

export default JoinScrum;
