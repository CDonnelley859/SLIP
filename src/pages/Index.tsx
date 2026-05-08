import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { syncCards } from "@/lib/racingApi";
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Card = { id: string; trackName: string; raceDate: string; postTime: string; raceCount: number };
type ActiveSlip = { scrumId: string; scrumName: string; trackName: string; completed: number; total: number };

const genCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const Index = () => {
  const { userId, handle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [cards, setCards] = useState<Card[]>([]);
  const [activeSlips, setActiveSlips] = useState<ActiveSlip[]>([]);
  const [trackSearch, setTrackSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Create group (inline)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [groupName, setGroupName] = useState("");
  const [createName, setCreateName] = useState(handle);
  const [creating, setCreating] = useState(false);

  // Join group (inline)
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(handle);
  const [joining, setJoining] = useState(false);

  useEffect(() => { loadData(); }, [userId, location.key]);

  // Keep name fields in sync with handle when handle changes
  useEffect(() => {
    setCreateName(h => h || handle);
    setJoinName(h => h || handle);
  }, [handle]);

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10);
    const cardsSnap = await getDocs(
      query(collection(db, "cards"), where("raceDate", "==", today))
    );
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

    const slips: ActiveSlip[] = [];
    for (const m of membersSnap.docs) {
      const scrumId = m.data().scrumId;
      const scrumDoc = await getDoc(doc(db, "scrums", scrumId));
      if (!scrumDoc.exists()) continue;
      const scrum = scrumDoc.data();

      const cardDoc = await getDoc(doc(db, "cards", scrum.cardId));
      const cardData = cardDoc.data();

      const racesSnap = await getDocs(
        query(collection(db, "races"), where("cardId", "==", scrum.cardId))
      );
      const total = racesSnap.size;
      const completed = racesSnap.docs.filter(r => r.data().status === "settled").length;
      if (total > 0 && completed >= total) continue;

      slips.push({
        scrumId,
        scrumName: scrum.name,
        trackName: cardData?.trackName ?? "—",
        completed,
        total,
      });
    }
    setActiveSlips(slips);
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
      const joinCode = genCode();
      const scrumId = crypto.randomUUID();
      await setDoc(doc(db, "scrums", scrumId), {
        cardId: selectedCard.id,
        hostId: userId,
        name: groupName.trim(),
        joinCode,
      });
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: createName.trim() || handle,
      });
      toast.success(`Group code: ${joinCode}`);
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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-background border-b-brutalist flex justify-center items-center w-full h-16 px-4 sticky top-0 z-50">
        <h1 className="text-headline-xl font-black tracking-tighter uppercase">SLIP</h1>
      </header>

      <main className="px-4">
        {/* Track tiles */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-label-caps uppercase">Top Tracks</h2>
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="text-label-caps uppercase underline underline-offset-2 disabled:opacity-40"
            >
              {syncing ? "LOADING…" : "REFRESH"}
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="border-brutalist p-6 text-center">
              <p className="text-body-md text-muted-foreground">
                No cards loaded. Hit Refresh to pull today's racecards.
              </p>
            </div>
          ) : (
            <div className="flex overflow-x-auto snap-x snap-mandatory -mx-4 pb-2 gap-3 px-4 scroll-px-4">
              {filteredCards.map((c) => {
                const isSelected = selectedCard?.id === c.id;
                const firstRace = c.postTime
                  ? new Date(c.postTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—";
                return (
                  <button
                    key={c.id}
                    onClick={() => isSelected ? setSelectedCard(null) : handleSelectCard(c)}
                    className={`flex-shrink-0 w-[calc(100vw-2rem)] snap-center border-brutalist p-4 flex flex-col justify-between h-32 text-left transition-none
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    <span className="text-headline-md uppercase leading-tight">
                      {c.trackName}
                    </span>
                    <div className={`flex gap-4 items-end ${isSelected ? "opacity-70" : "text-muted-foreground"}`}>
                      <span className="text-label-caps uppercase">{firstRace}</span>
                      <span className="text-label-caps uppercase">{c.raceCount} RACES</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Search */}
        <section className="mt-4">
          <div className="relative flex border-brutalist h-14">
            <label className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              SEARCH_TRACKS
            </label>
            <input
              value={trackSearch}
              onChange={e => setTrackSearch(e.target.value)}
              placeholder="ENTER TRACK NAME"
              className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
        </section>

        {/* Single box: JOIN GROUP or CREATE GROUP depending on track selection */}
        <section className="mt-4">
          <div className="border-brutalist relative">
            {/* Label + cancel (create mode only) */}
            <span className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              {selectedCard ? "CREATE GROUP" : "JOIN GROUP"}
            </span>
            {selectedCard && (
              <div className="flex items-center justify-between px-4 h-8 border-b border-primary/20">
                <span className="text-label-caps text-muted-foreground uppercase text-[10px]">
                  {selectedCard.trackName}
                </span>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="text-label-caps uppercase opacity-40"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedCard ? (
              /* CREATE mode */
              <form onSubmit={handleCreate}>
                <div className="flex border-b border-primary/20 h-14">
                  <input
                    autoFocus
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="GROUP NAME"
                    maxLength={40}
                    className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                </div>
                <div className="relative flex border-b border-primary/20 h-14">
                  <label className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">YOUR_NAME</label>
                  <input
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="YOUR NAME IN THIS GROUP"
                    maxLength={30}
                    className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating || !groupName.trim() || !createName.trim()}
                  className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase disabled:opacity-40 transition-none"
                >
                  {creating ? "CREATING…" : "CREATE GROUP"}
                </button>
              </form>
            ) : (
              /* JOIN mode */
              <form onSubmit={handleJoin}>
                <div className="flex border-b border-primary/20 h-14">
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="ENTER JOIN CODE"
                    maxLength={4}
                    className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none font-mono tracking-widest"
                  />
                </div>
                <div className="relative flex border-b border-primary/20 h-14">
                  <label className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">YOUR_NAME</label>
                  <input
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                    placeholder="YOUR NAME IN THIS GROUP"
                    maxLength={30}
                    className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 4 || !joinName.trim()}
                  className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase disabled:opacity-40 transition-none"
                >
                  {joining ? "JOINING…" : "JOIN GROUP"}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Active slips */}
        <section className="mt-8">
          <h2 className="text-label-caps uppercase mb-2">Active Slips</h2>
          {activeSlips.length === 0 ? (
            <div className="border-brutalist p-6 text-center">
              <p className="text-body-md text-muted-foreground">
                No active slips. Pick a track above or enter a group code.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {activeSlips.map((s, i) => (
                <div
                  key={s.scrumId}
                  className={`border-brutalist bg-background ${i > 0 ? "mt-[-2.67px]" : ""}`}
                >
                  <Link
                    to={`/scrum/${s.scrumId}/lobby`}
                    className="p-4 flex flex-col gap-3 block"
                  >
                    <div>
                      <span className="text-label-caps text-muted-foreground uppercase block">VENUE</span>
                      <span className="text-headline-md uppercase">{s.trackName}</span>
                      <div className="mt-1">
                        <span className="text-label-caps text-muted-foreground uppercase block">GROUP</span>
                        <span className="text-body-md font-bold uppercase">{s.scrumName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-label-caps uppercase">
                        <span>PROGRESS</span>
                        <span>{s.completed}/{s.total || 6}</span>
                      </div>
                      <div className="h-3 w-full border border-primary p-[1px]">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${s.total ? (s.completed / s.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-primary/20 px-4 py-2 flex justify-end">
                    <button
                      onClick={() => handleLeave(s.scrumId)}
                      className="text-label-caps uppercase text-destructive underline underline-offset-2"
                    >
                      LEAVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-center pb-8">
          <Link
            to="/spindle"
            className="text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
          >
            View The Spindle
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default Index;
