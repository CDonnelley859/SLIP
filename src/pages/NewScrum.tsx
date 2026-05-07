import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const NewScrum = () => {
  const { userId } = useAuth();
  const [params] = useSearchParams();
  const cardId = params.get("card");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!cardId) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const joinCode = genCode();
      const scrumRef = await addDoc(collection(db, "scrums"), {
        cardId,
        hostId: userId,
        name,
        joinCode,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "scrums", scrumRef.id, "members", userId), {
        userId,
        joinedAt: serverTimestamp(),
      });
      toast.success(`Scrum created · code ${joinCode}`);
      navigate(`/scrum/${scrumRef.id}/stalls`);
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
