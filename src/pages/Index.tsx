import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncCards, syncResults } from "@/lib/racingApi";
import { seedVirtualTrack, settleVirtualRaces, RACE_COUNT as VIRTUAL_RACE_COUNT, RACE_GAP_MS as VIRTUAL_RACE_GAP_MS } from "@/lib/virtualTrack";
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Card = { id: string; trackName: string; raceDate: string; postTime: string; raceCount: number; isVirtual?: boolean };
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
  const [createError, setCreateError] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(handle);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => { loadData(); }, [userId, location.key]);

  useEffect(() => {
    setCreateName(h => h || handle);
    setJoinName(h => h || handle);
  }, [handle]);

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10);

    // Start fetching members immediately — runs in parallel with card fetching
    const membersPromise = userId
      ? getDocs(query(collection(db, "scrumMembers"), where("userId", "==", userId)))
      : Promise.resolve(null);

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
      isVirtual: d.data().isVirtual ?? false,
    })).sort((a, b) => a.postTime.localeCompare(b.postTime));

    // Always include Blotto Park regardless of raceDate (timezone-proof)
    if (!cardList.find(c => c.id === "blotto-park")) {
      try {
        const bpDoc = await getDoc(doc(db, "cards", "blotto-park"));
        if (bpDoc.exists()) {
          const d = bpDoc.data();
          cardList.push({
            id: "blotto-park",
            trackName: d.trackName,
            raceDate: d.raceDate,
            postTime: d.postTime,
            raceCount: d.raceCount ?? 0,
            isVirtual: true,
          });
          cardList.sort((a, b) => a.postTime.localeCompare(b.postTime));
        }
      } catch { }
    }

    setCards(cardList);

    // Work out the current slot — same +RACE_GAP_MS offset as seedVirtualTrack
    // so the next card becomes visible 20 mins before its races start
    const VCARD_MS = VIRTUAL_RACE_COUNT * VIRTUAL_RACE_GAP_MS; // 2 hours
    const vDay = new Date(); vDay.setHours(0, 0, 0, 0);
    const vSlot = Math.floor((Date.now() + VIRTUAL_RACE_GAP_MS - vDay.getTime()) / VCARD_MS);
    const vSlotStart = vDay.getTime() + vSlot * VCARD_MS;

    // Seed if the card in the list doesn't match the current slot
    const virtualCard = cardList.find(c => c.id === "blotto-park");
    const needsSeed = !virtualCard ||
      new Date(virtualCard.postTime).getTime() !== vSlotStart;

    // Use slot-specific sessionStorage keys so it re-seeds when the slot turns over
    const seedKey = `blotto-seeded-${vSlotStart}`;
    const settleKey = `blotto-settled-${vSlotStart}`;

    if (needsSeed && !sessionStorage.getItem(seedKey)) {
      sessionStorage.setItem(seedKey, "1");
      seedVirtualTrack().then(() => loadData()).catch(() => {});
    } else if (!needsSeed) {
      if (!sessionStorage.getItem(settleKey)) {
        sessionStorage.setItem(settleKey, "1");
        settleVirtualRaces().catch(() => {});
      }
    }

    if (!userId) return;
    // Await members — likely already resolved since it started in parallel
    const membersSnap = await membersPromise;
    if (!membersSnap) return;

    const scrumDocs = await Promise.all(
      membersSnap.docs.map(m => getDoc(doc(db, "scrums", m.data().scrumId)))
    );

    const uniqueCardIds = [...new Set(
      membersSnap.docs
        .map((m, i) => scrumDocs[i].exists() ? scrumDocs[i].data().cardId : null)
        .filter(Boolean) as string[]
    )];
    // Only sync results for today's real cards — skip virtual and old/past cards
    const todayCardIds = new Set(cardList.map(c => c.id));
    await Promise.all(
      uniqueCardIds
        .filter(cid => cid !== "blotto-park" && todayCardIds.has(cid))
        .map(cid => syncResults(cid).catch(() => {}))
    );

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
    if (!selectedCard || !groupName.trim() || !userId) return;
    setCreating(true);
    setCreateError("");
    try {
      const code = genCode();
      const scrumId = crypto.randomUUID();
      await setDoc(doc(db, "scrums", scrumId), {
        cardId: selectedCard.id, hostId: userId, name: groupName.trim(),
        joinCode: code, showDetails: false,
      });
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: createName.trim() || handle,
      });
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (err: any) {
      const msg = err?.message || "Failed to create — please try again";
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || joinCode.length < 4) return;
    setJoining(true);
    setJoinError("");
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
      const msg = err?.message || "Failed to join — please try again";
      setJoinError(msg);
      toast.error(msg);
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
            <span className="label" style={{ color: "var(--cream)" }}>TOP TRACKS</span>
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
              {syncing ? "SYNCING…" : "REFRESH"}
            </button>
          </div>

          {cards.length === 0 && !syncing ? (
            <div style={{ border: "3px solid var(--cream)", padding: "24px", textAlign: "center" }}>
              <p className="label" style={{ color: "var(--cream)" }}>No races today.</p>
            </div>
          ) : (
            <div style={{
              display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none",
              paddingBottom: 4,
            }}>
              {(syncing && cards.length === 0 ? [0, 1, 2] : filteredCards).map((c, i) => {
                if (typeof c === "number") {
                  return (
                    <div key={i} style={{ flexShrink: 0, width: "82vw", maxWidth: 320, scrollSnapAlign: "start", border: "3px solid var(--cream)", padding: "18px 16px 16px" }}>
                      <div style={{ height: 28, width: 160, background: "rgba(245,232,223,0.15)", marginBottom: 10 }} />
                      <div style={{ height: 11, width: 100, background: "rgba(245,232,223,0.1)" }} />
                    </div>
                  );
                }
                const card = c as Card;
                const isSelected = selectedCard?.id === card.id;
                const firstRaceTime = card.postTime
                  ? new Date(card.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—";
                // Next upcoming race for virtual cards (null if card hasn't started yet)
                const nextRaceTime = (() => {
                  if (!card.isVirtual || !card.postTime) return null;
                  const post = new Date(card.postTime).getTime();
                  if (Date.now() < post) return null; // not started yet
                  const lastRace = post + (VIRTUAL_RACE_COUNT - 1) * VIRTUAL_RACE_GAP_MS;
                  const n = Math.ceil((Date.now() - post) / VIRTUAL_RACE_GAP_MS);
                  const next = Math.min(post + n * VIRTUAL_RACE_GAP_MS, lastRace);
                  return new Date(next).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                })();
                return (
                  <button
                    key={card.id}
                    onClick={() => isSelected ? setSelectedCard(null) : handleSelectCard(card)}
                    className="animate-fade-in"
                    style={{
                      flexShrink: 0, width: "82vw", maxWidth: 320, scrollSnapAlign: "start",
                      textAlign: "left", padding: "18px 16px 16px",
                      border: "3px solid var(--cream)",
                      background: isSelected ? "var(--pink)" : "var(--green)",
                      color: isSelected ? "var(--ink)" : "var(--cream)",
                      cursor: "pointer", transition: "all 120ms",
                    }}
                  >
                    <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>
                      {card.trackName}
                    </div>
                    <div className="mono" style={{ fontSize: 11, marginTop: 8, opacity: 0.7, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span>FIRST {firstRaceTime}</span>
                      {nextRaceTime && <span>NEXT {nextRaceTime}</span>}
                      {card.isVirtual ? (
                        <span style={{
                          background: isSelected ? "var(--ink)" : "var(--pink)",
                          color: "var(--cream)", padding: "1px 5px",
                        }}>VIRTUAL</span>
                      ) : (
                        <span>{card.raceCount} RACES</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SEARCH ── */}
        <section style={{ padding: "14px 18px 0" }}>
          <div style={{ border: "3px solid var(--cream)", position: "relative" }}>
            <div
              className="label-sm"
              style={{
                position: "absolute", top: -1, left: 12,
                transform: "translateY(-50%)",
                background: "var(--green)", padding: "0 4px",
                color: "var(--cream)", letterSpacing: "0.18em",
              }}
            >
              SEARCH TRACKS
            </div>
            <input
              value={trackSearch}
              onChange={e => setTrackSearch(e.target.value)}
              placeholder="ENTER TRACK NAME"
              className="mono"
              style={{
                width: "100%", border: 0,
                background: "transparent", padding: "14px 14px",
                fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "var(--cream)", outline: "none",
              }}
            />
          </div>
        </section>

        {/* ── JOIN / CREATE ── */}
        <section style={{ padding: "14px 18px 0" }}>
          {selectedCard && (
            <button
              onClick={() => setSelectedCard(null)}
              className="label-sm"
              style={{ background: "transparent", border: 0, color: "var(--cream)", opacity: 0.5, cursor: "pointer", marginBottom: 6 }}
            >
              ← BACK
            </button>
          )}
          <div style={{ border: "3px solid var(--cream)", position: "relative" }}>
            <div
              className="label-sm"
              style={{
                position: "absolute", top: -1, left: 12,
                transform: "translateY(-50%)",
                background: "var(--green)", padding: "0 4px",
                color: "var(--cream)", letterSpacing: "0.18em",
              }}
            >
              {selectedCard ? `CREATE GROUP — ${selectedCard.trackName}` : "JOIN GROUP"}
            </div>

            {selectedCard ? (
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column" }}>
                <input
                  autoFocus
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="ENTER GROUP NAME"
                  maxLength={40}
                  className="mono"
                  style={{
                    border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.3)",
                    background: "transparent", padding: "16px 14px",
                    fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "var(--cream)", outline: "none", width: "100%",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)", opacity: 0.7 }}>YOUR NAME</div>
                  <input
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="YOUR NAME"
                    maxLength={30}
                    className="mono"
                    style={{
                      border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.3)",
                      background: "transparent", padding: "16px 14px",
                      fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "var(--cream)", outline: "none", width: "100%",
                    }}
                  />
                </div>
                {createError && (
                  <div className="mono" style={{ padding: "10px 14px", color: "var(--pink)", fontSize: 11, background: "rgba(0,0,0,0.2)" }}>
                    ⚠ {createError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creating || !groupName.trim() || !createName.trim()}
                  className="display"
                  style={{
                    background: (creating || !groupName.trim() || !createName.trim()) ? "rgba(245,232,223,0.25)" : "var(--cream)",
                    color: (creating || !groupName.trim() || !createName.trim()) ? "rgba(245,232,223,0.5)" : "var(--ink)",
                    border: 0, padding: "16px", fontSize: 18, letterSpacing: "0.06em",
                    cursor: "pointer", width: "100%", textTransform: "uppercase",
                  }}
                >
                  {creating ? "CREATING…" : "CREATE GROUP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column" }}>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="ENTER JOIN CODE"
                  maxLength={4}
                  className="mono"
                  style={{
                    border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.3)",
                    background: "transparent", padding: "16px 14px",
                    fontSize: 20, letterSpacing: "0.3em", textTransform: "uppercase",
                    color: "var(--cream)", outline: "none", width: "100%",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)", opacity: 0.7 }}>YOUR NAME</div>
                  <input
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                    placeholder="YOUR NAME"
                    maxLength={30}
                    className="mono"
                    style={{
                      border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.3)",
                      background: "transparent", padding: "16px 14px",
                      fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "var(--cream)", outline: "none", width: "100%",
                    }}
                  />
                </div>
                {joinError && (
                  <div className="mono" style={{ padding: "10px 14px", color: "var(--pink)", fontSize: 11, background: "rgba(0,0,0,0.2)" }}>
                    ⚠ {joinError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 4}
                  className="display"
                  style={{
                    background: (joining || joinCode.length < 4) ? "rgba(245,232,223,0.25)" : "var(--cream)",
                    color: (joining || joinCode.length < 4) ? "rgba(245,232,223,0.5)" : "var(--ink)",
                    border: 0, padding: "16px", fontSize: 18, letterSpacing: "0.06em",
                    cursor: "pointer", width: "100%", textTransform: "uppercase",
                  }}
                >
                  {joining ? "JOINING…" : "JOIN GROUP"}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ── ACTIVE SLIPS ── */}
        <section style={{ padding: "24px 18px 0" }}>
          <span className="label" style={{ color: "var(--cream)", display: "block", marginBottom: 10 }}>
            ACTIVE GROUPS
          </span>

          {slipsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ border: "3px solid var(--cream)", borderBottom: i === 0 ? "1.5px solid rgba(245,232,223,0.4)" : "3px solid var(--cream)", padding: "16px" }}>
                  <div style={{ height: 8, width: 50, background: "rgba(245,232,223,0.15)", marginBottom: 6 }} />
                  <div style={{ height: 24, width: 150, background: "rgba(245,232,223,0.15)", marginBottom: 8 }} />
                  <div style={{ height: 8, width: 80, background: "rgba(245,232,223,0.15)" }} />
                </div>
              ))}
            </div>
          ) : activeSlips.length === 0 ? (
            <div style={{ border: "3px solid var(--cream)", padding: "24px", textAlign: "center" }}>
              <p className="label" style={{ color: "var(--cream)", opacity: 0.5 }}>
                No active slips. Pick a track above or enter a join code.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {activeSlips.map((s, i) => {
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
                    className="animate-fade-in"
                    style={{
                      border: "3px solid var(--cream)",
                      borderBottom: i < activeSlips.length - 1 ? "1.5px solid rgba(245,232,223,0.4)" : "3px solid var(--cream)",
                      color: "var(--cream)",
                    }}
                  >
                    {/* Main content */}
                    <div
                      onClick={() => navigate(`/scrum/${s.scrumId}/lobby`)}
                      style={{ padding: "16px 16px 12px", cursor: "pointer" }}
                    >
                      <div className="label-sm" style={{ opacity: 0.6, marginBottom: 2 }}>VENUE</div>
                      <div className="display" style={{ fontSize: 28, lineHeight: 1, marginBottom: 10 }}>{s.trackName}</div>
                      <div className="label-sm" style={{ opacity: 0.6, marginBottom: 2 }}>GROUP</div>
                      <div className="display" style={{ fontSize: 18, lineHeight: 1, marginBottom: 10 }}>{s.scrumName}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span className="label-sm" style={{ opacity: 0.6 }}>NEXT RACE</span>
                        <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{nextRaceDisplay}</span>
                      </div>
                    </div>

                    {/* Bottom row */}
                    <div style={{ borderTop: "1.5px solid rgba(245,232,223,0.3)", padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
                      <button
                        onClick={() => handleLeave(s.scrumId)}
                        className="label"
                        style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", textDecoration: "underline" }}
                      >
                        LEAVE
                      </button>
                      <button
                        onClick={() => navigate(`/scrum/${s.scrumId}/slip`)}
                        className="label"
                        style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--cream)", textDecoration: "underline" }}
                      >
                        SHOW SLIPS
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
