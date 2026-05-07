import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const NewScrum = () => {
  const { userId, handle } = useAuth();
  const [params] = useSearchParams();
  const cardId = params.get("card");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!cardId) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const joinCode = genCode();
      const scrumRef = await addDoc(collection(db, "scrums"), {
        cardId,
        hostId: userId,
        name: name.trim(),
        joinCode,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "scrums", scrumRef.id, "members", userId), {
        userId,
        handle,
        joinedAt: serverTimestamp(),
      });
      toast.success(`Group code: ${joinCode}`);
      navigate(`/scrum/${scrumRef.id}/gallop`);
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
        <h1 className="text-body-lg uppercase">New Group</h1>
      </header>

      <main className="px-4 pt-6 max-w-sm">
        <form onSubmit={create}>
          <div className="relative border-brutalist">
            <label className="absolute top-[-9px] left-3 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              GROUP_NAME
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="THE SATURDAY CREW"
              maxLength={40}
              className="w-full bg-transparent px-4 py-4 text-data-mono uppercase placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist border-t-0 disabled:opacity-40 transition-none"
          >
            {busy ? "CREATING…" : "CREATE GROUP"}
          </button>
        </form>
        <p className="text-label-caps text-muted-foreground uppercase mt-4 text-center">
          A join code will be generated for you to share
        </p>
      </main>
    </div>
  );
};

export default NewScrum;
