import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
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
      const snap = await getDocs(
        query(collection(db, "scrums"), where("joinCode", "==", code.toUpperCase().trim()))
      );
      if (snap.empty) throw new Error("Code not found");
      const scrumId = snap.docs[0].id;
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId,
      });
      navigate(`/scrum/${scrumId}/gallop`);
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
