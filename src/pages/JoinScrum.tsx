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
    <div className="min-h-screen" style={{ background: "var(--green)" }}>
      <header
        style={{
          background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
          display: "flex", alignItems: "center", height: 64, padding: "0 18px",
          position: "sticky", top: 0, zIndex: 50,
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="label"
          style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", marginRight: 16 }}
        >
          ← BACK
        </button>
        <span className="display" style={{ fontSize: 20, color: "var(--cream)" }}>JOIN GROUP</span>
      </header>

      <main style={{ padding: "24px 18px", maxWidth: 420 }}>
        <form onSubmit={join}>
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
            <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>GROUP CODE</div>
            <input
              autoFocus
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="XXXX"
              maxLength={4}
              className="mono"
              style={{ width: "100%", border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.25)", background: "transparent", padding: "16px 14px", fontSize: 20, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--cream)", outline: "none", textAlign: "center" }}
            />
            <div className="label-sm" style={{ position: "absolute", top: "calc(50% + 1px)", left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>YOUR NAME</div>
            <input
              required
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="YOUR NAME IN THIS GROUP"
              maxLength={30}
              className="mono"
              style={{ width: "100%", border: 0, background: "transparent", padding: "16px 14px", fontSize: 14, textTransform: "uppercase", color: "var(--cream)", outline: "none" }}
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 4 || !playerName.trim()}
            className="display"
            style={{
              width: "100%", padding: "16px", fontSize: 18, letterSpacing: "0.06em",
              textTransform: "uppercase", border: 0, cursor: "pointer",
              background: (busy || code.length < 4 || !playerName.trim()) ? "rgba(245,232,223,0.25)" : "var(--cream)",
              color: (busy || code.length < 4 || !playerName.trim()) ? "rgba(245,232,223,0.4)" : "var(--ink)",
            }}
          >
            {busy ? "JOINING…" : "JOIN"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default JoinScrum;
