import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncCards, syncResults } from "@/lib/racingApi";
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Card = { id: string; trackName: string; raceDate: string; postTime: string; raceCount: number };
type ActiveSlip = { scrumId: string; scrumName: string; trackName: string; completed: number; total: number; settled: number; nextRaceTime: string | null };

const genCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const Index = () => {
  const { userId, handle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [cards, setCards] = useState<Card[]>([]);
  const [activeSlips, setActiveSlips] = useState<ActiveSlip[]>([]);
  const [trackSearch, setTrackSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [slipsLoading, setSlipsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [groupName, setGroupName] = useState("");
  const [createName, setCreateName] = useState(handle);
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(handle);
  const [joining, setJoining] = useState(false);

  useEffect(() => { loadData(); }, [userId, location.key]);

  useEffect(() => {
    setCreateName(h => h || handle);
    setJoinName(h => h || handle);
  }, [handle]);

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10);
    let cardsSnap = await getDocs(
      query(collection(db, "cards"), where("raceDate", "==", today))
    );

    if (cardsSnap.empty) {
      setSyncing(true);
      try {
        await syncCards();
        cardsSnap = await getDocs(
          query(collection(db, "cards"), where("raceDate", "==", today))
        );
      } catch { } finally {
        setSyncing(false);
      }
    }

    const cardList: Card[] = cardsSnap.docs.map(d => ({
      id: d.id,
      trackName: d.data().trackName,
      raceDate: d.data().raceDate,
      postTime: d.data().postTime,
      raceCount: d.data().raceCount ?? 0,
    })).sort((a, b) => a.postTime.localeCompare(b.postTime));
    setCards(cardList);

    if (!userId) return;
    const membersSnap = await getDocs(
      query(collection(db, "scrumMembers"), where("userId", "==", userId))
    );

    const scrumDocs = await Promise.all(
      membersSnap.docs.map(m => getDoc(doc(db, "scrums", m.data().scrumId)))
    );

    const uniqueCardIds = [...new Set(
      membersSnap.docs
        .map((m, i) => scrumDocs[i].exists() ? scrumDocs[i].data().cardId : null)
        .filter(Boolean) as string[]
    )];
    await Promise.all(uniqueCardIds.map(cid => syncResults(cid).catch(() => {})));

    const slipResults = await Promise.all(
      membersSnap.docs.map(async (m, i) => {
        const scrumId = m.data().scrumId;
        const scrumDoc = scrumDocs[i];
        if (!scrumDoc.exists()) return null;
        const scrum = scrumDoc.data();

        const [cardDoc, racesSnap, picksSnap] = await Promise.all([
          getDoc(doc(db, "cards", scrum.cardId)),
          getDocs(query(collection(db, "races"), where("cardId", "==", scrum.cardId))),
          getDocs(query(collection(db, "picks"),
            where("scrumId", "==", scrumId),
            where("userId", "==", userId))),
        ]);

        const cardData = cardDoc.data();
        if (cardData?.raceDate && cardData.raceDate < today) return null;

        const total = racesSnap.size;
        const settled = racesSnap.docs.filter(r => r.data().status === "settled").length;
        if (settled === total && total > 0) return null;

        const nowTs = Date.now();
        const nextRace = racesSnap.docs
          .filter(r => r.data().status !== "settled" && r.data().offTime)
          .map(r => r.data().offTime as string)
          .filter(t => new Date(t).getTime() > nowTs)
          .sort()[0] ?? null;

        return {
          scrumId,
          scrumName: scrum.name,
          trackName: cardData?.trackName ?? "—",
          completed: picksSnap.size,
          total,
          settled,
          nextRaceTime: nextRace,
        };
      })
    );

    setActiveSlips(slipResults.filter(Boolean) as ActiveSlip[]);
    setSlipsLoading(false);
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      const result = await syncCards();
      toast.success(result);
      loadData();
    } catch (err: any) {
      toast.error(err.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function handleSelectCard(card: Card) {
    setSelectedCard(card);
    setGroupName("");
    setCreateName(handle);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !groupName.trim()) return;
    setCreating(true);
    try {
      const code = genCode();
      const scrumId = crypto.randomUUID();
      await setDoc(doc(db, "scrums", scrumId), {
        cardId: selectedCard.id, hostId: userId, name: groupName.trim(),
        joinCode: code, showDetails: true,
      });
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: createName.trim() || handle,
      });
      toast.success(`Group code: ${code}`);
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || joinCode.length < 4) return;
    setJoining(true);
    try {
      const snap = await getDocs(
        query(collection(db, "scrums"), where("joinCode", "==", joinCode.toUpperCase().trim()))
      );
      if (snap.empty) throw new Error("Code not found");
      const scrumId = snap.docs[0].id;
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: joinName.trim() || handle,
      });
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(scrumId: string) {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await deleteDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`));
      setActiveSlips(prev => prev.filter(s => s.scrumId !== scrumId));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const filteredCards = cards.filter(c =>
    c.trackName.toLowerCase().includes(trackSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen halftone-bg pb-20" style={{ background: "var(--green)" }}>

      {/* ── HEADER ── */}
      <header
        style={{
          background: "var(--green)",
          borderBottom: "3px solid rgba(245,232,223,0.3)",
          padding: "20px 18px 8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link
            to="/spindle"
            className="label"
            style={{ color: "var(--cream)", textDecoration: "underline" }}
          >
            SPINDLE
          </Link>
          <h1
            className="display"
            style={{ fontSize: 56, color: "var(--cream)" }}
          >
            SLIP
          </h1>
          <Link
            to="/stats"
            className="label"
            style={{ color: "var(--cream)", textDecoration: "underline" }}
          >
            THE FORM
          </Link>
        </div>
      </header>

      <main>

        {/* ── TOP TRACKS ── */}
        <section style={{ padding: "16px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="label" style={{ color: "var(--cream)" }}>Top Tracks</span>
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="label"
              style={{
                background: "transparent", border: 0, color: "var(--cream)",
                textDecoration: "underline", cursor: "pointer",
                opacity: syncing ? 0.4 : 1,
              }}
            >
              {syncing ? "SYNCING…" : "↻ REFRESH"}
            </button>
          </div>

          {cards.length === 0 && !syncing ? (
            <div
              className="animate-fade-in"
              style={{
                border: "3px solid rgba(245,232,223,0.3)", padding: "24px",
                textAlign: "center", background: "var(--green)",
              }}
            >
              <p className="label" style={{ color: "var(--cream)" }}>No races today.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(syncing && cards.length === 0 ? [0, 1, 2, 3] : filteredCards).map((c, i) => {
                if (typeof c === "number") {
                  return (
                    <div
                      key={i}
                      style={{
                        border: "3px solid rgba(245,232,223,0.3)", padding: "12px 12px 14px",
                        background: "var(--green)", height: 90,
                      }}
                    >
                      <div style={{ height: 8, width: 80, background: "rgba(245,232,223,0.2)", marginBottom: 8 }} />
                      <div style={{ height: 20, width: 100, background: "rgba(245,232,223,0.2)" }} />
                    </div>
                  );
                }
                const card = c as Card;
                const isSelected = selectedCard?.id === card.id;
                const isFeatured = i < 2;
                const firstRace = card.postTime
                  ? new Date(card.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—";
                return (
                  <button
                    key={card.id}
                    onClick={() => isSelected ? setSelectedCard(null) : handleSelectCard(card)}
                    className="halftone-bg halftone-loose animate-fade-in"
                    style={{
                      textAlign: "left",
                      padding: "12px 12px 14px",
                      border: isFeatured ? "3px solid var(--ink)" : "2px solid rgba(245,232,223,0.3)",
                      background: isSelected ? "var(--cream)" : isFeatured ? "var(--pink)" : "var(--green)",
                      color: isSelected ? "var(--ink)" : isFeatured ? "var(--ink)" : "var(--cream)",
                      cursor: "pointer",
                      boxShadow: isSelected ? "4px 4px 0 var(--ink)" : "none",
                      transition: "all 120ms",
                    }}
                  >
                    <div className="label-sm" style={{ opacity: 0.7, marginBottom: 4 }}>
                      {isFeatured ? "★ FEATURED" : "TODAY"}
                    </div>
                    <div className="display" style={{ fontSize: 22 }}>
                      {card.trackName}
                    </div>
                    <div className="mono" style={{ fontSize: 11, marginTop: 6, display: "flex", gap: 6 }}>
                      <span>{firstRace}</span>
                      <span>·</span>
                      <span>{card.raceCount} RACES</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SEARCH ── */}
        <section style={{ padding: "14px 18px 0" }}>
          <input
            value={trackSearch}
            onChange={e => setTrackSearch(e.target.value)}
            placeholder="SEARCH TRACKS…"
            className="mono"
            style={{
              width: "100%", border: "3px solid var(--ink)",
              background: "var(--cream)", padding: "12px 14px",
              fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ink)", outline: "none",
            }}
          />
        </section>

        {/* ── JOIN / CREATE ── */}
        <section style={{ padding: "14px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="perf" style={{ flex: 1, opacity: 0.4 }} />
            <span className="label" style={{ whiteSpace: "nowrap", color: "var(--cream)" }}>
              {selectedCard ? `CREATE GROUP — ${selectedCard.trackName}` : "OR JOIN A CREW"}
            </span>
            <div className="perf" style={{ flex: 1, opacity: 0.4 }} />
            {selectedCard && (
              <button
                onClick={() => setSelectedCard(null)}
                style={{
                  background: "transparent", border: 0, cursor: "pointer",
                  fontSize: 14, color: "var(--cream)", opacity: 0.5,
                }}
              >✕</button>
            )}
          </div>

          {selectedCard ? (
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <input
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="GROUP NAME"
                maxLength={40}
                className="mono"
                style={{
                  border: "3px solid var(--ink)", borderBottom: "1.5px solid var(--ink)",
                  background: "var(--cream)", padding: "12px 14px",
                  fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "var(--ink)", outline: "none",
                }}
              />
              <input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="YOUR NAME"
                maxLength={30}
                className="mono"
                style={{
                  border: "3px solid var(--ink)", borderTop: 0, borderBottom: "1.5px solid var(--ink)",
                  background: "var(--cream)", padding: "12px 14px",
                  fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "var(--ink)", outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={creating || !groupName.trim() || !createName.trim()}
                className="btn-retro btn-retro-green"
                style={{ marginTop: 8 }}
              >
                {creating ? "CREATING…" : "CREATE GROUP →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="JOIN CODE"
                  maxLength={4}
                  className="mono"
                  style={{
                    flex: 1, border: "3px solid var(--ink)",
                    background: "var(--cream)", padding: "12px 14px",
                    fontSize: 20, letterSpacing: "0.3em", textTransform: "uppercase",
                    color: "var(--ink)", outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 4}
                  className="btn-retro btn-retro-pink"
                  style={{
                    width: "auto", padding: "12px 18px",
                    opacity: (joining || joinCode.length < 4) ? 0.4 : 1,
                    boxShadow: "4px 4px 0 var(--ink)",
                  }}
                >
                  {joining ? "…" : "JOIN"}
                </button>
              </div>
              <input
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                placeholder="YOUR NAME"
                maxLength={30}
                className="mono"
                style={{
                  border: "3px solid var(--ink)", borderTop: 0,
                  background: "var(--cream)", padding: "12px 14px",
                  fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "var(--ink)", outline: "none",
                }}
              />
            </form>
          )}
        </section>

        {/* ── ACTIVE SLIPS ── */}
        <section style={{ padding: "24px 18px 0" }}>
          <span className="label" style={{ color: "var(--cream)", display: "block", marginBottom: 10 }}>
            Active Slips
          </span>

          {slipsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1].map(i => (
                <div
                  key={i}
                  style={{
                    border: "2px dashed rgba(245,232,223,0.4)", padding: "14px 16px",
                    background: "var(--green)",
                  }}
                >
                  <div style={{ height: 8, width: 60, background: "rgba(245,232,223,0.2)", marginBottom: 6 }} />
                  <div style={{ height: 22, width: 140, background: "rgba(245,232,223,0.2)", marginBottom: 10 }} />
                  <div style={{ height: 8, width: 80, background: "rgba(245,232,223,0.2)" }} />
                </div>
              ))}
            </div>
          ) : activeSlips.length === 0 ? (
            <div
              className="animate-fade-in"
              style={{
                border: "2px dashed rgba(245,232,223,0.4)", padding: "24px",
                textAlign: "center", background: "var(--green)",
              }}
            >
              <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>
                No active slips. Pick a track above or enter a join code.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeSlips.map(s => {
                const nextRaceDisplay = s.nextRaceTime
                  ? (() => {
                      const diff = new Date(s.nextRaceTime).getTime() - now;
                      if (diff <= 0) return "—";
                      const h = Math.floor(diff / 3600000);
                      const m = Math.floor((diff % 3600000) / 60000);
                      const sec = Math.floor((diff % 60000) / 1000);
                      return h > 0
                        ? `${h}H ${String(m).padStart(2, "0")}M`
                        : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
                    })()
                  : "—";

                return (
                  <div
                    key={s.scrumId}
                    className="halftone-bg animate-fade-in"
                    style={{
                      border: "2px dashed rgba(245,232,223,0.4)",
                      background: "var(--green)",
                    }}
                  >
                    <div
                      onClick={() => navigate(`/scrum/${s.scrumId}/slip`)}
                      style={{ display: "block", padding: "14px 16px", cursor: "pointer", color: "var(--cream)" }}
                    >
                      {/* Top row: venue + GO disc */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div>
                          <div className="label-sm" style={{ opacity: 0.7, marginBottom: 2 }}>VENUE</div>
                          <div className="display" style={{ fontSize: 26 }}>{s.trackName}</div>
                        </div>
                        {/* GO circle */}
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%",
                          background: "var(--pink)", border: "3px solid var(--ink)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative", overflow: "hidden", flexShrink: 0,
                        }}>
                          <div style={{
                            position: "absolute", inset: 0,
                            backgroundImage: "radial-gradient(var(--ink) 1px, transparent 1.4px)",
                            backgroundSize: "6px 6px", opacity: 0.20, mixBlendMode: "multiply" as const,
                          }} />
                          <span className="label-sm" style={{ color: "var(--cream)", position: "relative", zIndex: 2 }}>GO</span>
                        </div>
                      </div>

                      {/* perf divider */}
                      <div className="perf" style={{ margin: "10px 0", opacity: 0.4 }} />

                      {/* Bottom row: next race + show slips */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div className="label-sm" style={{ opacity: 0.7 }}>NEXT RACE</div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                            {nextRaceDisplay}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span className="label-sm">SHOW SLIPS</span>
                          <span style={{ fontSize: 18 }}>→</span>
                        </div>
                      </div>
                    </div>

                    {/* leave button */}
                    <div style={{ borderTop: "2px dashed rgba(245,232,223,0.4)", padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleLeave(s.scrumId)}
                        className="label"
                        style={{
                          background: "transparent", border: 0, cursor: "pointer",
                          color: "var(--cream)", opacity: 0.5, textDecoration: "underline",
                        }}
                      >
                        LEAVE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default Index;
