import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

const JoinScrum = () => {
  const { userId, handle } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [playerName, setPlayerName] = useState(handle);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const snap = await getDocs(
        query(collection(db, "scrums"), where("joinCode", "==", code.toUpperCase().trim()))
      );
      if (snap.empty) throw new Error("Code not found");
      const scrumId = snap.docs[0].id;
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: playerName.trim() || handle,
      });
      navigate(`/scrum/${scrumId}/lobby`);
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
              placeholder="XXXX"
              maxLength={4}
              className="w-full bg-transparent px-4 py-4 text-data-mono uppercase placeholder:text-muted-foreground/40 focus:outline-none font-mono tracking-widest text-center"
            />
          </div>
          <div className="relative border-brutalist border-t-0">
            <label className="absolute top-[-9px] left-3 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              YOUR_NAME
            </label>
            <input
              required
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="YOUR NAME IN THIS GROUP"
              maxLength={30}
              className="w-full bg-transparent px-4 py-4 text-data-mono uppercase placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 4 || !playerName.trim()}
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
