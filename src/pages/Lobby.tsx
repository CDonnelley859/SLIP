import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, deleteDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { saveCrew } from "@/lib/crews";

type LeaderRow = { userId: string; handle: string; points: number; wins: number; places: number; shows: number };

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
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [togglingDetails, setTogglingDetails] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showSaveCrew, setShowSaveCrew] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [savingCrew, setSavingCrew] = useState(false);
  const [crewSaved, setCrewSaved] = useState(false);

  // Countdown timer
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

  // Load data + live leaderboard
  useEffect(() => {
    if (!id) return;
    let unsubFn: (() => void) | undefined;
    (async () => {
      try {
        const scrumDoc = await getDoc(doc(db, "scrums", id));
        if (!scrumDoc.exists()) {
          setLoadError("Group not found. It may still be loading — try going back and tapping the group again.");
          return;
        }
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

        unsubFn = onSnapshot(
          query(collection(db, "picks"), where("scrumId", "==", id)),
          (snap) => {
            // Seed all members at 0 so everyone appears even before picking
            const statsByUser: Record<string, { points: number; wins: number; places: number; shows: number }> = {};
            Object.keys(handleMap).forEach(uid => {
              statsByUser[uid] = { points: 0, wins: 0, places: 0, shows: 0 };
            });
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
      } catch (err: any) {
        setLoadError(err?.message || "Failed to load group — please go back and try again.");
      }
    })();
    return () => { if (unsubFn) unsubFn(); };
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

  async function handleSaveCrew() {
    if (!crewName.trim() || !userId) return;
    setSavingCrew(true);
    try {
      await saveCrew(
        crewName.trim(),
        members.map(m => ({ userId: m.userId, handle: m.handle })),
        userId,
      );
      setCrewSaved(true);
      setShowSaveCrew(false);
      setCrewName("");
      toast.success("Crew saved!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCrew(false);
    }
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--green)", padding: "32px 24px" }}>
      {loadError ? (
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <p className="label" style={{ color: "var(--pink)", marginBottom: 16 }}>⚠ {loadError}</p>
          <button
            onClick={() => navigate("/")}
            className="label"
            style={{ background: "transparent", border: "2px solid var(--cream)", color: "var(--cream)", padding: "10px 20px", cursor: "pointer" }}
          >
            ← BACK TO PADDOCK
          </button>
        </div>
      ) : (
        <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Loading…</p>
      )}
    </div>
  );

  const picksLocked = countdown === "PICKS LOCKED";

  return (
    <div className="min-h-screen halftone-bg" style={{ background: "var(--green)" }}>

      {/* ── HEADER ── */}
      <header style={{ background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.3)", padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← PADDOCK</Link>
          <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>THE PEN</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 32, color: "var(--cream)", lineHeight: 1 }}>{scrum.name}</div>
        </div>
      </header>

      <main style={{ padding: "18px 18px 80px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Mega Slip banner */}
        {scrum.megaSlipId && (
          <button
            onClick={() => navigate(`/mega/${scrum.megaSlipId}/hub`)}
            style={{
              width: "100%", textAlign: "left", background: "var(--ink)", border: "3px solid var(--cream)",
              padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>PART OF MEGA GROUP</span>
            <span className="label" style={{ color: "var(--cream)", textDecoration: "underline" }}>VIEW HUB →</span>
          </button>
        )}

        {/* ── JOIN CODE ── */}
        <div
          className="halftone-bg halftone-loose"
          style={{
            border: "3px solid var(--ink)",
            background: "var(--pink)", color: "var(--ink)",
            padding: "16px", textAlign: "center",
            boxShadow: "5px 5px 0 var(--ink)",
          }}
        >
          <div className="label-sm" style={{ opacity: 0.85, color: "var(--ink)" }}>JOIN CODE</div>
          <div className="display" style={{ fontSize: 56, letterSpacing: "0.16em", marginTop: 4, color: "var(--ink)" }}>
            {scrum.joinCode}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 6 }}>
            <button onClick={handleCopyCode} className="label-sm" style={{ background: "transparent", border: 0, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}>
              COPY
            </button>
            <span className="label-sm" style={{ color: "var(--ink)", opacity: 0.5 }}>·</span>
            <button onClick={handleShare} className="label-sm" style={{ background: "transparent", border: 0, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}>
              SHARE
            </button>
          </div>
        </div>

        {/* ── VENUE CARD ── */}
        <div style={{ border: "3px solid rgba(245,232,223,0.3)", background: "var(--green)", color: "var(--cream)" }}>
          {/* Venue info — matches Hub track card style */}
          <div style={{ padding: "14px 16px 12px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <div className="display" style={{ fontSize: 30, lineHeight: 1 }}>{card?.trackName ?? "—"}</div>
              {card?.isVirtual && (
                <span style={{ background: "var(--pink)", color: "var(--cream)", padding: "1px 5px", fontSize: 9 }} className="mono">VIRTUAL</span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 10, opacity: 0.6 }}>
              {[
                card?.raceCount ? `${card.raceCount} RACES` : null,
                card?.postTime ? new Date(card.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
                countdown && countdown !== "PICKS LOCKED" ? countdown : countdown === "PICKS LOCKED" ? "UNDERWAY" : null,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ borderTop: "1.5px solid rgba(245,232,223,0.2)", display: "flex" }}>
            <button
              onClick={() => navigate(`/scrum/${id}/gallop`)}
              className="display"
              style={{
                flex: 1, border: 0, borderRight: "1.5px solid rgba(245,232,223,0.2)",
                background: "var(--green)",
                color: "var(--cream)",
                padding: "14px 10px", fontSize: 14, letterSpacing: "0.06em",
                textTransform: "uppercase", cursor: "pointer",
              }}
            >
              {picksLocked ? "PICK OPEN RACES →" : "START PICKING →"}
            </button>
            <button
              onClick={() => navigate(`/scrum/${id}/slip`)}
              className="display"
              style={{
                flex: 1, border: 0, background: "transparent",
                color: "var(--cream)", padding: "14px 10px",
                fontSize: 14, letterSpacing: "0.06em",
                textTransform: "uppercase", cursor: "pointer",
              }}
            >
              SHOW SLIPS
            </button>
          </div>
        </div>

        {/* ── STANDINGS ── */}
        <div>
          <span className="label" style={{ color: "var(--cream)", display: "block", marginBottom: 10 }}>STANDINGS</span>
          {leaderboard.length === 0 ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.3)", padding: 24, textAlign: "center" }}>
              <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>No players yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {leaderboard.map((row, i) => {
                const isMe = row.userId === userId;
                return (
                  <div
                    key={row.userId}
                    style={{
                      border: "3px solid rgba(245,232,223,0.3)",
                      borderBottom: i < leaderboard.length - 1 ? "1.5px solid rgba(245,232,223,0.2)" : "3px solid rgba(245,232,223,0.3)",
                      padding: "12px 16px",
                      background: isMe ? "var(--pink)" : "transparent",
                      color: isMe ? "var(--ink)" : "var(--cream)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <span className="display" style={{ fontSize: 28, lineHeight: 1, minWidth: 32, opacity: 0.5 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div className="display" style={{ fontSize: 18, lineHeight: 1 }}>{row.handle}</div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 4, opacity: 0.65 }}>
                        {row.wins}W · {row.places}P · {row.shows}S
                      </div>
                    </div>
                    <div className="display" style={{ fontSize: 32, lineHeight: 1 }}>
                      {row.points}<span style={{ fontSize: 12, marginLeft: 4, opacity: 0.6 }}>PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── HOST SETTINGS ── */}
        {userId === scrum.hostId ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)" }}>
            {/* Header — tap to toggle */}
            <button
              onClick={() => setShowHostSettings(s => !s)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "transparent", border: 0, cursor: "pointer", padding: "12px 14px",
              }}
            >
              <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.6 }}>HOST SETTINGS</span>
              <span className="mono" style={{ color: "var(--cream)", opacity: 0.5, fontSize: 14 }}>
                {showHostSettings ? "▲" : "▼"}
              </span>
            </button>
            {showHostSettings && (
              <>
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
                <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", padding: "4px 14px" }}>
                  <Link
                    to={`/scrum/${id}/host-results`}
                    className="label"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--cream)", textDecoration: "none", padding: "10px 0" }}
                  >
                    <span>Enter Results</span>
                    <span style={{ opacity: 0.5 }}>→</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
            <span className="label" style={{ color: "var(--cream)" }}>Horse Data</span>
            <span className="label-sm" style={{ opacity: 0.6, color: "var(--cream)" }}>
              {(scrum.showDetails ?? false) ? "FULL CARD" : "NAME ONLY"}
            </span>
          </div>
        )}

        {/* ── SAVE AS CREW ── */}
        {crewSaved ? (
          <p className="label-sm" style={{ textAlign: "center", color: "var(--cream)", opacity: 0.45, padding: "12px 0" }}>
            ✓ CREW SAVED
          </p>
        ) : showSaveCrew ? (
          <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "14px" }}>
            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginBottom: 10 }}>
              SAVE {members.length} PLAYERS AS A CREW
            </p>
            <input
              autoFocus
              value={crewName}
              onChange={e => setCrewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveCrew()}
              placeholder="CREW NAME"
              maxLength={30}
              className="mono"
              style={{
                width: "100%", background: "transparent",
                border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.4)",
                color: "var(--cream)", fontSize: 15, padding: "6px 0",
                outline: "none", letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: 14, boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setShowSaveCrew(false); setCrewName(""); }}
                className="label-sm"
                style={{
                  flex: 1, background: "transparent",
                  border: "1.5px solid rgba(245,232,223,0.4)", color: "var(--cream)",
                  padding: "8px", cursor: "pointer",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveCrew}
                disabled={savingCrew || !crewName.trim()}
                className="label-sm"
                style={{
                  flex: 1, background: "var(--cream)",
                  border: "1.5px solid var(--ink)", color: "var(--ink)",
                  padding: "8px", cursor: "pointer", fontWeight: 700,
                  opacity: (savingCrew || !crewName.trim()) ? 0.4 : 1,
                }}
              >
                {savingCrew ? "SAVING…" : "SAVE CREW"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveCrew(true)}
            className="label"
            style={{
              border: "2px dashed rgba(245,232,223,0.35)", background: "transparent",
              color: "var(--cream)", padding: "12px", width: "100%",
              cursor: "pointer", opacity: 0.5,
            }}
          >
            SAVE AS CREW
          </button>
        )}

        {/* ── LEAVE ── */}
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
              cursor: "pointer", opacity: 0.55, marginTop: 4,
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
