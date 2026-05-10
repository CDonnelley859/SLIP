import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

const genCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const NewScrum = () => {
  const { userId, handle } = useAuth();
  const [params] = useSearchParams();
  const cardId = params.get("card");
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState(handle);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!cardId) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const joinCode = genCode();
      const scrumId = crypto.randomUUID();

      await setDoc(doc(db, "scrums", scrumId), {
        cardId,
        hostId: userId,
        name: name.trim(),
        joinCode,
      });

      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: playerName.trim() || handle,
      });

      toast.success(`Group code: ${joinCode}`);
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (e: any) {
      toast.error(e.message);
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
        <span className="display" style={{ fontSize: 20, color: "var(--cream)" }}>NEW GROUP</span>
      </header>

      <main style={{ padding: "24px 18px", maxWidth: 420 }}>
        <form onSubmit={create}>
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
            <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>GROUP NAME</div>
            <input
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="THE SATURDAY CREW"
              maxLength={40}
              className="mono"
              style={{ width: "100%", border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.25)", background: "transparent", padding: "16px 14px", fontSize: 14, textTransform: "uppercase", color: "var(--cream)", outline: "none" }}
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
            disabled={busy || !name.trim() || !playerName.trim()}
            className="display"
            style={{
              width: "100%", padding: "16px", fontSize: 18, letterSpacing: "0.06em",
              textTransform: "uppercase", border: 0, cursor: "pointer",
              background: (busy || !name.trim() || !playerName.trim()) ? "rgba(245,232,223,0.25)" : "var(--cream)",
              color: (busy || !name.trim() || !playerName.trim()) ? "rgba(245,232,223,0.4)" : "var(--ink)",
            }}
          >
            {busy ? "CREATING…" : "CREATE GROUP"}
          </button>
        </form>
        <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 16, textAlign: "center" }}>
          A JOIN CODE WILL BE GENERATED FOR YOU TO SHARE
        </p>
      </main>
    </div>
  );
};

export default NewScrum;
