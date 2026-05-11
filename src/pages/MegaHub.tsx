import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, onSnapshot, deleteDoc, writeBatch, updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  getMegaSlip, addTrackToMega, removeTrackFromMega, type MegaSlip,
} from "@/lib/megaSlip";

type TrackEntry = {
  scrumId: string;
  cardId: string;
  trackName: string;
  postTime: string;
  raceCount: number;
  isVirtual: boolean;
};

type LeaderRow = {
  userId: string;
  handle: string;
  total: number;
  wins: number;
  places: number;
  shows: number;
  byTrack: Record<string, number>; // scrumId → points
};

type AvailableCard = {
  id: string;
  trackName: string;
  postTime: string;
  raceCount: number;
  isVirtual: boolean;
};

const MegaHub = () => {
  const { id: megaSlipId } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [mega, setMega] = useState<MegaSlip | null>(null);
  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [members, setMembers] = useState<{ userId: string; handle: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Add track panel
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [availableCards, setAvailableCards] = useState<AvailableCard[]>([]);
  const [addingCard, setAddingCard] = useState<string | null>(null);

  // Host settings
  const [showDetails, setShowDetails] = useState(false);
  const [togglingDetails, setTogglingDetails] = useState(false);

  // Leave
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isHost = mega?.hostId === userId;

  // ── Load mega slip + tracks ──────────────────────────────────────────────────
  async function loadMega() {
    if (!megaSlipId) return;
    try {
      const megaData = await getMegaSlip(megaSlipId);
      if (!megaData) { setError("Mega Slip not found."); return; }
      setMega(megaData);

      // Load showDetails from first scrum
      if (megaData.scrumIds.length > 0) {
        try {
          const firstScrum = await getDoc(doc(db, "scrums", megaData.scrumIds[0]));
          if (firstScrum.exists()) setShowDetails(firstScrum.data().showDetails ?? false);
        } catch { }
      }

      // Load card details for each track
      const trackEntries: TrackEntry[] = [];
      for (let i = 0; i < megaData.scrumIds.length; i++) {
        const scrumId = megaData.scrumIds[i];
        const cardId = megaData.cardIds[i];
        try {
          const cardDoc = await getDoc(doc(db, "cards", cardId));
          if (cardDoc.exists()) {
            const d = cardDoc.data();
            trackEntries.push({
              scrumId,
              cardId,
              trackName: d.trackName,
              postTime: d.postTime,
              raceCount: d.raceCount ?? 0,
              isVirtual: d.isVirtual ?? false,
            });
          }
        } catch { }
      }
      trackEntries.sort((a, b) => a.postTime.localeCompare(b.postTime));
      setTracks(trackEntries);

      // Load members
      const membersSnap = await getDocs(
        query(collection(db, "megaSlipMembers"), where("megaSlipId", "==", megaSlipId))
      );
      setMembers(membersSnap.docs.map(d => ({
        userId: d.data().userId,
        handle: d.data().handle,
      })));
    } catch {
      setError("Something went wrong loading this Mega Slip.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMega(); }, [megaSlipId]);

  // ── Live leaderboard via picks snapshot ──────────────────────────────────────
  useEffect(() => {
    if (!mega || mega.scrumIds.length === 0) return;
    const unsub = onSnapshot(
      query(collection(db, "picks"), where("scrumId", "in", mega.scrumIds)),
      (snap) => {
        // Seed every member at 0 so they always appear in standings
        const byUser: Record<string, LeaderRow> = {};
        members.forEach(m => {
          byUser[m.userId] = {
            userId: m.userId,
            handle: m.handle,
            total: 0, wins: 0, places: 0, shows: 0,
            byTrack: {},
          };
        });
        snap.docs.forEach(p => {
          const { userId: uid, scrumId, points } = p.data();
          const pts = points ?? 0;
          if (!byUser[uid]) {
            byUser[uid] = {
              userId: uid,
              handle: members.find(m => m.userId === uid)?.handle ?? "—",
              total: 0, wins: 0, places: 0, shows: 0,
              byTrack: {},
            };
          }
          byUser[uid].total += pts;
          byUser[uid].byTrack[scrumId] = (byUser[uid].byTrack[scrumId] ?? 0) + pts;
          if (pts === 5) byUser[uid].wins++;
          else if (pts === 3) byUser[uid].places++;
          else if (pts === 1) byUser[uid].shows++;
        });
        const sorted = Object.values(byUser).sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.places - a.places;
        });
        setLeaderboard(sorted);
      }
    );
    return () => unsub();
  }, [mega?.scrumIds.join(","), members.length]);

  // ── Load available cards to add ──────────────────────────────────────────────
  async function loadAvailableCards() {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await getDocs(
      query(collection(db, "cards"), where("raceDate", "==", today))
    );
    const existing = new Set(mega?.cardIds ?? []);
    const cards: AvailableCard[] = snap.docs
      .filter(d => !existing.has(d.id))
      .map(d => ({
        id: d.id,
        trackName: d.data().trackName,
        postTime: d.data().postTime,
        raceCount: d.data().raceCount ?? 0,
        isVirtual: d.data().isVirtual ?? false,
      }))
      .sort((a, b) => a.postTime.localeCompare(b.postTime));

    // Also include virtual cards not in today's date query
    try {
      const { activeVirtualCardIds } = await import("@/lib/virtualTrack");
      const vIds = activeVirtualCardIds().filter(id => !existing.has(id));
      const vDocs = await Promise.all(vIds.map(id => getDoc(doc(db, "cards", id))));
      vDocs.forEach((d) => {
        if (d.exists() && !cards.find(c => c.id === d.id)) {
          cards.push({
            id: d.id,
            trackName: d.data().trackName,
            postTime: d.data().postTime,
            raceCount: d.data().raceCount ?? 0,
            isVirtual: true,
          });
        }
      });
      cards.sort((a, b) => a.postTime.localeCompare(b.postTime));
    } catch { }

    setAvailableCards(cards);
  }

  async function handleAddTrack(card: AvailableCard) {
    if (!megaSlipId || !mega || !userId) return;
    setAddingCard(card.id);
    try {
      await addTrackToMega(megaSlipId, card, userId, mega.name);
      await loadMega();
      setShowAddTrack(false);
      toast.success(`${card.trackName} added`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add track");
    } finally {
      setAddingCard(null);
    }
  }

  async function handleRemoveTrack(scrumId: string, trackName: string) {
    if (!megaSlipId) return;
    if (!window.confirm(`Remove ${trackName} from this Mega Slip?`)) return;
    try {
      await removeTrackFromMega(megaSlipId, scrumId);
      await loadMega();
      toast.success(`${trackName} removed`);
    } catch {
      toast.error("Failed to remove track");
    }
  }

  function handleCopyCode() {
    if (!mega) return;
    navigator.clipboard.writeText(mega.joinCode).then(() => toast.success("Code copied!"));
  }

  function handleShare() {
    if (!mega) return;
    const url = `${window.location.origin}/join-mega/${mega.joinCode}`;
    if (navigator.share) {
      navigator.share({ title: mega.name, text: `Join my Mega Slip! Code: ${mega.joinCode}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Invite link copied!"));
    }
  }

  async function handleToggleDetails() {
    if (!mega) return;
    setTogglingDetails(true);
    const next = !showDetails;
    try {
      const batch = writeBatch(db);
      mega.scrumIds.forEach(scrumId => {
        batch.update(doc(db, "scrums", scrumId), { showDetails: next });
      });
      await batch.commit();
      setShowDetails(next);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setTogglingDetails(false);
    }
  }

  async function handleLeave() {
    if (!megaSlipId || !userId || !mega) return;
    setLeaving(true);
    try {
      // Remove from mega slip members
      await deleteDoc(doc(db, "megaSlipMembers", `${megaSlipId}_${userId}`));
      // Remove from all track scrums
      const batch = writeBatch(db);
      mega.scrumIds.forEach(scrumId => {
        batch.delete(doc(db, "scrumMembers", `${scrumId}_${userId}`));
      });
      await batch.commit();
      navigate("/");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to leave");
      setLeaving(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function nextRaceCountdown(postTime: string): string {
    const diff = new Date(postTime).getTime() - now;
    if (diff <= 0) return "UNDERWAY";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return h > 0
      ? `${h}H ${String(m).padStart(2, "0")}M`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ── Loading / error states ───────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--green)" }}>
      <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Loading…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--green)", padding: 24 }}>
      <p className="label" style={{ color: "var(--cream)", marginBottom: 16 }}>{error}</p>
      <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "underline" }}>← HOME</Link>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen halftone-bg pb-20" style={{ background: "var(--green)" }}>

      {/* HEADER */}
      <header style={{ background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.3)", padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← HOME</Link>
          <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>MEGA SLIP</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 32, color: "var(--cream)", lineHeight: 1 }}>{mega?.name}</div>
        </div>
      </header>

      <main style={{ padding: "18px 18px 0" }}>

        {/* JOIN CODE */}
        <div
          className="halftone-bg halftone-loose"
          style={{
            border: "3px solid var(--ink)",
            background: "var(--pink)", color: "var(--ink)",
            padding: "16px", textAlign: "center",
            boxShadow: "5px 5px 0 var(--ink)",
            marginBottom: 14,
          }}
        >
          <div className="label-sm" style={{ opacity: 0.85, color: "var(--ink)" }}>JOIN CODE</div>
          <div className="display" style={{ fontSize: 56, letterSpacing: "0.16em", marginTop: 4, color: "var(--ink)" }}>
            {mega?.joinCode}
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

        {/* TRACKS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label" style={{ color: "var(--cream)" }}>TRACKS</span>
          {isHost && (
            <button
              onClick={() => { setShowAddTrack(s => !s); if (!showAddTrack) loadAvailableCards(); }}
              className="label"
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", textDecoration: "underline" }}
            >
              {showAddTrack ? "CANCEL" : "+ ADD TRACK"}
            </button>
          )}
        </div>

        {/* Add track panel */}
        {showAddTrack && (
          <div style={{ border: "3px solid var(--cream)", marginBottom: 12 }}>
            <div className="label-sm" style={{ padding: "8px 12px", borderBottom: "1.5px solid rgba(245,232,223,0.3)", color: "var(--cream)", opacity: 0.7 }}>
              SELECT A TRACK TO ADD
            </div>
            {availableCards.length === 0 ? (
              <p className="label-sm" style={{ padding: "16px 12px", color: "var(--cream)", opacity: 0.5 }}>No other tracks available today.</p>
            ) : (
              availableCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => handleAddTrack(card)}
                  disabled={addingCard === card.id}
                  style={{
                    width: "100%", textAlign: "left", padding: "12px", display: "flex",
                    justifyContent: "space-between", alignItems: "center",
                    background: "transparent", border: 0, borderBottom: "1px solid rgba(245,232,223,0.15)",
                    color: "var(--cream)", cursor: "pointer", opacity: addingCard === card.id ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div className="display" style={{ fontSize: 16 }}>{card.trackName}</div>
                    <div className="mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{formatTime(card.postTime)} · {card.raceCount} RACES</div>
                  </div>
                  <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>
                    {addingCard === card.id ? "ADDING…" : "ADD →"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Track list */}
        {tracks.length === 0 ? (
          <div style={{ border: "3px solid var(--cream)", padding: 24, textAlign: "center" }}>
            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>No tracks yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {tracks.map((t, i) => {
              const isLast = i === tracks.length - 1;
              const countdown = nextRaceCountdown(t.postTime);
              return (
                <div
                  key={t.scrumId}
                  style={{
                    border: "3px solid var(--cream)",
                    borderBottom: isLast ? "3px solid var(--cream)" : "1.5px solid rgba(245,232,223,0.4)",
                    color: "var(--cream)",
                  }}
                >
                  <div style={{ padding: "14px 16px 10px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <div className="display" style={{ fontSize: 20, lineHeight: 1 }}>{t.trackName}</div>
                      {t.isVirtual && (
                        <span style={{ background: "var(--pink)", color: "var(--cream)", padding: "1px 5px", fontSize: 9 }} className="mono">VIRTUAL</span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 10, opacity: 0.6 }}>
                      {formatTime(t.postTime)} · {t.raceCount} RACES · {countdown}
                    </div>
                  </div>
                  {isHost && (
                    <div style={{ padding: "6px 16px 0", display: "flex", justifyContent: "flex-start" }}>
                      <button
                        onClick={() => handleRemoveTrack(t.scrumId, t.trackName)}
                        className="label-sm"
                        style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", opacity: 0.45, textDecoration: "underline" }}
                      >
                        REMOVE
                      </button>
                    </div>
                  )}
                  <div style={{ borderTop: "1.5px solid rgba(245,232,223,0.2)", display: "flex" }}>
                      <button
                        onClick={() => navigate(`/scrum/${t.scrumId}/gallop`)}
                        className="display"
                        style={{
                          flex: 1, border: 0, borderRight: "1.5px solid rgba(245,232,223,0.2)",
                          background: "var(--ink)", cursor: "pointer",
                          color: "var(--cream)", padding: "14px 10px",
                          fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
                        }}
                      >
                        PICK HORSES →
                      </button>
                      <button
                        onClick={() => navigate(`/scrum/${t.scrumId}/slip`)}
                        className="display"
                        style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", color: "var(--cream)", padding: "14px 10px", fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}
                      >
                        SLIPS
                      </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LEADERBOARD */}
        <div style={{ marginTop: 28 }}>
          <span className="label" style={{ color: "var(--cream)", display: "block", marginBottom: 10 }}>STANDINGS</span>

          {leaderboard.length === 0 ? (
            <div style={{ border: "3px solid var(--cream)", padding: 24, textAlign: "center" }}>
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
                      border: "3px solid var(--cream)",
                      borderBottom: i < leaderboard.length - 1 ? "1.5px solid rgba(245,232,223,0.4)" : "3px solid var(--cream)",
                      padding: "12px 16px",
                      background: isMe ? "var(--pink)" : "transparent",
                      color: isMe ? "var(--ink)" : "var(--cream)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <span className="display" style={{ fontSize: 28, lineHeight: 1, minWidth: 32, opacity: 0.5 }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="display" style={{ fontSize: 18, lineHeight: 1 }}>{row.handle}</div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 4, opacity: 0.65 }}>
                        {row.wins}W · {row.places}P · {row.shows}S
                      </div>
                    </div>
                    <div className="display" style={{ fontSize: 32, lineHeight: 1 }}>
                      {row.total}<span style={{ fontSize: 12, marginLeft: 4, opacity: 0.6 }}>PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* ── HOST SETTINGS ── */}
        {isHost && (
          <div style={{ marginTop: 28, border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)" }}>
            <div className="label-sm" style={{ padding: "10px 14px 6px", opacity: 0.5, color: "var(--cream)" }}>HOST SETTINGS</div>
            {/* Horse data toggle — applies to all tracks */}
            <div style={{ borderTop: "1px solid rgba(245,232,223,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
              <span className="label" style={{ color: "var(--cream)" }}>Horse Data</span>
              <button
                onClick={handleToggleDetails}
                disabled={togglingDetails}
                style={{
                  border: "2px solid rgba(245,232,223,0.5)",
                  background: showDetails ? "var(--cream)" : "transparent",
                  color: showDetails ? "var(--ink)" : "var(--cream)",
                  fontWeight: 700, fontSize: 9, letterSpacing: "0.14em",
                  textTransform: "uppercase", padding: "6px 10px", cursor: "pointer",
                  opacity: togglingDetails ? 0.4 : 1,
                }}
              >
                {showDetails ? "FULL CARD" : "NAME ONLY"}
              </button>
            </div>
            {/* Enter results per track */}
            {tracks.map((t, i) => (
              <div key={t.scrumId} style={{ borderTop: "1px solid rgba(245,232,223,0.15)", padding: "4px 14px" }}>
                <button
                  onClick={() => navigate(`/scrum/${t.scrumId}/host-results`)}
                  className="label"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", background: "transparent", border: 0, cursor: "pointer",
                    color: "var(--cream)", padding: "10px 0", textAlign: "left",
                  }}
                >
                  <span>Enter Results — {t.trackName}</span>
                  <span style={{ opacity: 0.5 }}>→</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── LEAVE ── */}
        <div style={{ marginTop: 28 }}>
          {confirmLeave ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", background: "var(--green)", padding: "14px" }}>
              <p className="label" style={{ textAlign: "center", marginBottom: 12, color: "var(--cream)" }}>
                Are you sure you want to leave this Mega Group?
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
                cursor: "pointer", opacity: 0.55,
              }}
            >
              LEAVE GROUP
            </button>
          )}
        </div>

      </main>
    </div>
  );
};

export default MegaHub;
