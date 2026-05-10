import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, deleteDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";


const Lobby = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [members, setMembers] = useState<{ handle: string; userId: string; submitted: boolean }[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ handle: string; points: number; userId: string }[]>([]);
  const [togglingDetails, setTogglingDetails] = useState(false);

  useEffect(() => {
    if (!card?.postTime) return;
    const target = new Date(card.postTime).getTime();
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("PICKS LOCKED"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(h > 0
        ? `${h}H ${String(m).padStart(2, "0")}M`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [card?.postTime]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const scrumDoc = await getDoc(doc(db, "scrums", id));
      if (!scrumDoc.exists()) { navigate("/"); return; }
      const scrumData = scrumDoc.data();
      setScrum(scrumData);

      const cardDoc = await getDoc(doc(db, "cards", scrumData.cardId));
      setCard(cardDoc.data());

      const membersSnap = await getDocs(
        query(collection(db, "scrumMembers"), where("scrumId", "==", id))
      );
      const picksSnap = await getDocs(
        query(collection(db, "picks"), where("scrumId", "==", id))
      );
      const submittedUserIds = new Set(picksSnap.docs.map(d => d.data().userId));
      const memberList = membersSnap.docs.map(d => ({
        handle: d.data().handle ?? "Anonymous",
        userId: d.data().userId,
        submitted: submittedUserIds.has(d.data().userId),
      }));
      setMembers(memberList);

      const handleMap: Record<string, string> = {};
      memberList.forEach(m => { handleMap[m.userId] = m.handle; });

      const unsub = onSnapshot(
        query(collection(db, "picks"), where("scrumId", "==", id)),
        (snap) => {
          const statsByUser: Record<string, { points: number; wins: number; places: number; shows: number }> = {};
          snap.docs.forEach(p => {
            const uid = p.data().userId;
            const pts = p.data().points ?? 0;
            if (!statsByUser[uid]) statsByUser[uid] = { points: 0, wins: 0, places: 0, shows: 0 };
            statsByUser[uid].points += pts;
            if (pts === 5) statsByUser[uid].wins++;
            else if (pts === 3) statsByUser[uid].places++;
            else if (pts === 1) statsByUser[uid].shows++;
          });
          const board = Object.entries(statsByUser)
            .map(([uid, s]) => ({ userId: uid, handle: handleMap[uid] ?? "—", ...s }))
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              if (b.wins !== a.wins) return b.wins - a.wins;
              if (b.places !== a.places) return b.places - a.places;
              return b.shows - a.shows;
            });
          setLeaderboard(board);
        }
      );
      return unsub;
    })();
  }, [id]);

  async function handleLeave() {
    if (!id || !userId) return;
    setLeaving(true);
    try {
      await deleteDoc(doc(db, "scrumMembers", `${id}_${userId}`));
      navigate("/");
    } catch { setLeaving(false); }
  }

  async function handleToggleDetails() {
    if (!id || !scrum) return;
    setTogglingDetails(true);
    const next = !(scrum.showDetails ?? false);
    try {
      await updateDoc(doc(db, "scrums", id), { showDetails: next });
      setScrum((s: any) => ({ ...s, showDetails: next }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingDetails(false);
    }
  }

  function handleCopyCode() {
    if (!scrum?.joinCode) return;
    navigator.clipboard.writeText(scrum.joinCode).then(() => toast.success("Code copied!"));
  }

  function handleShare() {
    if (!scrum?.joinCode) return;
    const url = `https://slip-racing.vercel.app/join/${scrum.joinCode}`;
    if (navigator.share) {
      navigator.share({ title: "SLIP", text: "Join my SLIP group!", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Invite link copied!"));
    }
  }

  if (!scrum) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--green)" }}>
      <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--green)" }}>

      {/* ── HEADER ── */}
      <header
        style={{
          padding: "16px 18px",
          marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          className="label"
          style={{ color: "var(--cream)", textDecoration: "none" }}
        >
          ← PADDOCK
        </Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>THE PEN</span>
        <div style={{ width: 60 }} />
      </header>

      <main style={{ padding: "0 18px 80px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* venue + group */}
        <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="label-sm" style={{ opacity: 0.7, color: "var(--cream)" }}>VENUE</div>
              <div className="display" style={{ fontSize: 30, marginTop: 2, color: "var(--cream)" }}>
                {card?.trackName ?? "—"}
              </div>
              <div className="label-sm" style={{ opacity: 0.7, marginTop: 10, color: "var(--cream)" }}>GROUP</div>
              <div className="display" style={{ fontSize: 22, marginTop: 2, color: "var(--cream)" }}>
                {scrum.name}
              </div>
            </div>
          </div>
        </div>

        {/* join code */}
        <div
          className="halftone-bg halftone-loose"
          style={{
            border: "3px solid var(--ink)",
            background: "var(--pink)", color: "var(--ink)",
            padding: "16px", marginBottom: 0,
            textAlign: "center",
            boxShadow: "5px 5px 0 var(--ink)",
          }}
        >
          <div className="label-sm" style={{ opacity: 0.85, color: "var(--ink)" }}>JOIN CODE</div>
          <div
            className="display"
            style={{ fontSize: 56, letterSpacing: "0.16em", marginTop: 4, color: "var(--ink)" }}
          >
            {scrum.joinCode}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 6 }}>
            <button
              onClick={handleCopyCode}
              className="label-sm"
              style={{ background: "transparent", border: 0, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}
            >
              COPY
            </button>
            <span className="label-sm" style={{ color: "var(--ink)", opacity: 0.5 }}>·</span>
            <button
              onClick={handleShare}
              className="label-sm"
              style={{ background: "transparent", border: 0, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}
            >
              SHARE
            </button>
          </div>
        </div>

        {/* countdown */}
        {countdown && (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "12px 14px", textAlign: "center" }}>
            <div className="label-sm" style={{ opacity: 0.7, color: "var(--cream)" }}>FIRST RACE IN</div>
            <div className="display" style={{ fontSize: 38, marginTop: 2, color: "var(--cream)" }}>
              {countdown}
            </div>
          </div>
        )}

        {/* players */}
        <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "10px 14px 4px" }}>
          <div className="label" style={{ marginBottom: 8, color: "var(--cream)" }}>Players — {members.length}</div>
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                padding: "8px 0",
                borderTop: "1px dashed rgba(245,232,223,0.3)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: m.userId === userId ? "var(--pink)" : "rgba(245,232,223,0.3)",
                  border: "2px solid rgba(245,232,223,0.5)", display: "inline-block", flexShrink: 0,
                }} />
                <span className="display" style={{ fontSize: 16, color: "var(--cream)" }}>
                  {m.handle}
                  {m.userId === userId && (
                    <span className="label-sm" style={{ opacity: 0.5, marginLeft: 6, color: "var(--cream)" }}>(YOU)</span>
                  )}
                </span>
              </div>
              <span className="label-sm" style={{ opacity: m.submitted ? 1 : 0.4, color: "var(--cream)" }}>
                {m.submitted ? "✓ PRINTED" : "PICKING…"}
              </span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <button
          onClick={() => navigate(`/scrum/${id}/gallop`)}
          className="btn-retro btn-retro-pink"
        >
          START PICKING →
        </button>

        <Link
          to={`/scrum/${id}/slip`}
          className="display"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid rgba(245,232,223,0.35)", background: "var(--green)",
            fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--cream)", textDecoration: "none",
            padding: "14px 18px",
          }}
        >
          SHOW SLIPS
        </Link>

        {/* host settings card */}
        {userId === scrum.hostId ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)" }}>
            <div className="label-sm" style={{ padding: "10px 14px 6px", opacity: 0.5, color: "var(--cream)" }}>HOST SETTINGS</div>
            {/* horse data row */}
            <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
              <span className="label" style={{ color: "var(--cream)" }}>Horse Data</span>
              <button
                onClick={handleToggleDetails}
                disabled={togglingDetails}
                style={{
                  border: "2px solid rgba(245,232,223,0.5)",
                  background: (scrum.showDetails ?? false) ? "var(--cream)" : "transparent",
                  color: (scrum.showDetails ?? false) ? "var(--ink)" : "var(--cream)",
                  fontWeight: 700, fontSize: 9, letterSpacing: "0.14em",
                  textTransform: "uppercase", padding: "6px 10px", cursor: "pointer",
                  opacity: togglingDetails ? 0.4 : 1,
                }}
              >
                {(scrum.showDetails ?? false) ? "FULL CARD" : "NAME ONLY"}
              </button>
            </div>
            {/* enter results row */}
            <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", padding: "4px 14px 4px" }}>
              <Link
                to={`/scrum/${id}/host-results`}
                className="label"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  color: "var(--cream)", textDecoration: "none", padding: "10px 0",
                }}
              >
                <span>Enter Results</span>
                <span style={{ opacity: 0.5 }}>→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
            <span className="label" style={{ color: "var(--cream)" }}>Horse Data</span>
            <span className="label-sm" style={{ opacity: 0.6, color: "var(--cream)" }}>
              {(scrum.showDetails ?? false) ? "FULL CARD" : "NAME ONLY"}
            </span>
          </div>
        )}

        {/* leave */}
        {confirmLeave ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", background: "var(--green)", padding: "14px" }}>
            <p className="label" style={{ textAlign: "center", marginBottom: 12, color: "var(--cream)" }}>
              Are you sure you want to leave?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmLeave(false)}
                className="display"
                style={{
                  flex: 1, border: "3px solid rgba(245,232,223,0.35)", background: "transparent",
                  fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--cream)", padding: "10px", cursor: "pointer",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="display"
                style={{
                  flex: 1, border: "3px solid var(--ink)", background: "var(--pink)",
                  fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--cream)", padding: "10px", cursor: "pointer",
                  opacity: leaving ? 0.4 : 1,
                }}
              >
                {leaving ? "LEAVING…" : "YES, LEAVE"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLeave(true)}
            className="label"
            style={{
              border: "2px dashed rgba(245,232,223,0.35)", background: "transparent",
              color: "var(--cream)", padding: "12px", width: "100%",
              cursor: "pointer", opacity: 0.55, marginTop: 10,
            }}
          >
            LEAVE GROUP
          </button>
        )}
      </main>
    </div>
  );
};

export default Lobby;
