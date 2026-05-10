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
    const next = !(scrum.showDetails ?? true);
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
        Loading…
      </p>
    </div>
  );

  const label: React.CSSProperties = {
    fontWeight: 700, fontSize: 9, letterSpacing: "0.18em",
    textTransform: "uppercase", opacity: 0.7, color: "var(--ink)",
  };
  const block: React.CSSProperties = {
    border: "3px solid var(--ink)",
    background: "var(--cream)",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "var(--cream)", borderBottom: "3px solid var(--ink)",
          padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", textDecoration: "none" }}
        >
          ← PADDOCK
        </Link>
        <span className="font-display" style={{ fontSize: 26, color: "var(--ink)" }}>THE PEN</span>
        <div style={{ width: 70 }} />
      </header>

      <main style={{ padding: "16px 18px 80px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* venue + group */}
        <div style={{ ...block, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={label}>VENUE</div>
              <div className="font-display" style={{ fontSize: 32, lineHeight: 0.9, marginTop: 2 }}>
                {card?.trackName ?? "—"}
              </div>
              <div style={{ ...label, marginTop: 10 }}>GROUP</div>
              <div className="font-display" style={{ fontSize: 22, lineHeight: 0.9, marginTop: 2 }}>
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
            background: "var(--retro-green)", color: "var(--cream)",
            padding: "16px 16px 14px", textAlign: "center",
            boxShadow: "5px 5px 0 var(--ink)",
          }}
        >
          <div style={{ ...label, opacity: 0.85, color: "var(--cream)" }}>JOIN CODE</div>
          <div
            className="font-display"
            style={{ fontSize: 56, letterSpacing: "0.16em", marginTop: 4, color: "var(--cream)" }}
          >
            {scrum.joinCode}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 6 }}>
            <button
              onClick={handleCopyCode}
              style={{ background: "transparent", border: 0, color: "var(--cream)", cursor: "pointer", fontWeight: 700, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "underline" }}
            >
              COPY
            </button>
            <button
              onClick={handleShare}
              style={{ background: "transparent", border: 0, color: "var(--cream)", cursor: "pointer", fontWeight: 700, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "underline" }}
            >
              SHARE
            </button>
          </div>
        </div>

        {/* countdown */}
        {countdown && (
          <div style={{ ...block, padding: "12px 14px", textAlign: "center" }}>
            <div style={label}>FIRST RACE IN</div>
            <div
              className="font-display"
              style={{ fontSize: 40, marginTop: 2, color: "var(--ink)" }}
            >
              {countdown}
            </div>
          </div>
        )}

        {/* players */}
        <div style={block}>
          <div style={{ padding: "10px 14px 8px", borderBottom: "2px solid var(--ink)" }}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              PLAYERS — {members.length}
            </span>
          </div>
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                borderTop: i > 0 ? "1px dashed var(--ink)" : "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: m.userId === userId ? "var(--retro-pink)" : "var(--retro-green)",
                  border: "2px solid var(--ink)", display: "inline-block", flexShrink: 0,
                }} />
                <span className="font-display" style={{ fontSize: 17 }}>
                  {m.handle}
                  {m.userId === userId && (
                    <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>(YOU)</span>
                  )}
                </span>
              </div>
              <span style={{
                fontWeight: 700, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                opacity: m.submitted ? 1 : 0.35,
              }}>
                {m.submitted ? "✓ PRINTED" : "PICKING…"}
              </span>
            </div>
          ))}
        </div>

        {/* leaderboard */}
        {leaderboard.some(r => r.points > 0) && (
          <div style={block}>
            <div style={{ padding: "10px 14px 8px", borderBottom: "2px solid var(--ink)" }}>
              <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                LEADERBOARD
              </span>
            </div>
            {leaderboard.map((r, i) => (
              <div
                key={r.userId}
                style={{
                  padding: "10px 14px",
                  borderTop: i > 0 ? "1px dashed var(--ink)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: r.userId === userId ? "var(--retro-pink-pale)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="font-display" style={{ fontSize: 14, opacity: 0.5 }}>#{i + 1}</span>
                  <span className="font-display" style={{ fontSize: 18 }}>{r.handle}</span>
                </div>
                <span className="font-display" style={{ fontSize: 28 }}>{r.points}</span>
              </div>
            ))}
          </div>
        )}

        {/* horse data toggle (host only) */}
        <div style={{ ...block, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Horse Data
          </span>
          {userId === scrum.hostId ? (
            <button
              onClick={handleToggleDetails}
              disabled={togglingDetails}
              style={{
                border: "2px solid var(--ink)",
                background: (scrum.showDetails ?? true) ? "var(--ink)" : "transparent",
                color: (scrum.showDetails ?? true) ? "var(--cream)" : "var(--ink)",
                fontWeight: 700, fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase", padding: "6px 10px", cursor: "pointer",
                opacity: togglingDetails ? 0.4 : 1,
              }}
            >
              {(scrum.showDetails ?? true) ? "FULL CARD" : "NAME ONLY"}
            </button>
          ) : (
            <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6 }}>
              {(scrum.showDetails ?? true) ? "FULL CARD" : "NAME ONLY"}
            </span>
          )}
        </div>

        {/* CTA buttons */}
        <button
          onClick={() => navigate(`/scrum/${id}/gallop`)}
          className="btn-retro btn-retro-green"
        >
          START PICKING →
        </button>

        <Link
          to={`/scrum/${id}/slip`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid var(--ink)", background: "var(--cream)",
            fontFamily: "Bagel Fat One, system-ui, sans-serif",
            fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--ink)", textDecoration: "none",
            padding: "14px 18px", opacity: 0.7,
          }}
        >
          SHOW SLIPS
        </Link>

        {userId === scrum.hostId && (
          <Link
            to={`/scrum/${id}/host-results`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "3px solid var(--ink)", background: "var(--retro-green)", color: "var(--cream)",
              fontFamily: "Bagel Fat One, system-ui, sans-serif",
              fontSize: 16, letterSpacing: "0.06em", textTransform: "uppercase",
              textDecoration: "none", padding: "14px 18px",
              boxShadow: "4px 4px 0 var(--ink)",
            }}
          >
            ENTER RESULTS →
          </Link>
        )}

        {/* leave */}
        {confirmLeave ? (
          <div style={{ ...block, padding: "14px" }}>
            <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
              Are you sure you want to leave?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmLeave(false)}
                style={{
                  flex: 1, border: "3px solid var(--ink)", background: "var(--cream)",
                  fontFamily: "Bagel Fat One, system-ui, sans-serif", fontSize: 14,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--ink)", padding: "10px", cursor: "pointer",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                style={{
                  flex: 1, border: "3px solid var(--ink)", background: "var(--retro-pink)",
                  fontFamily: "Bagel Fat One, system-ui, sans-serif", fontSize: 14,
                  letterSpacing: "0.06em", textTransform: "uppercase",
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
            style={{
              border: "2px dashed var(--ink)", background: "transparent",
              fontWeight: 700, fontSize: 11, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--ink)",
              padding: "12px", width: "100%", cursor: "pointer", opacity: 0.55,
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
