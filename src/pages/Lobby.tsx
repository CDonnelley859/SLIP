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

  // Countdown to first race
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

      // Check who has submitted picks
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

      // Live leaderboard — updates in real time as races settle
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
    navigator.clipboard.writeText(scrum.joinCode).then(() => {
      toast.success("Code copied!");
    });
  }

  function handleShare() {
    if (!scrum?.joinCode) return;
    const url = `https://slip-racing.vercel.app/join/${scrum.joinCode}`;
    const text = `Join my SLIP group — tap to join instantly!`;
    if (navigator.share) {
      navigator.share({ title: "SLIP", text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Invite link copied!"));
    }
  }

  if (!scrum) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-label-caps uppercase text-muted-foreground">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b-brutalist flex items-center justify-between h-16 px-4 sticky top-0 z-50">
        <Link to="/" className="text-label-caps uppercase hover:underline">← PADDOCK</Link>
        <h1 className="text-headline-md uppercase">THE PEN</h1>
        <div className="w-20" />
      </header>

      <main className="px-4 pt-6 pb-16 max-w-sm mx-auto flex flex-col gap-6">
        <div className="border-brutalist p-4">
          <span className="text-label-caps text-muted-foreground uppercase block">VENUE</span>
          <span className="text-headline-md uppercase">{card?.trackName ?? "—"}</span>
          <span className="text-label-caps text-muted-foreground uppercase block mt-2">GROUP</span>
          <span className="text-body-lg font-bold uppercase">{scrum.name}</span>
        </div>

        {/* Join code with copy + share */}
        <div className="border-brutalist p-6 flex flex-col items-center gap-2">
          <span className="text-label-caps text-muted-foreground uppercase">JOIN CODE</span>
          <span className="text-[56px] font-black tracking-[0.2em] font-mono leading-none">{scrum.joinCode}</span>
          <div className="flex gap-4 mt-1">
            <button onClick={handleCopyCode} className="text-label-caps uppercase underline underline-offset-2">
              COPY
            </button>
            <button onClick={handleShare} className="text-label-caps uppercase underline underline-offset-2">
              SHARE
            </button>
          </div>
        </div>

        {/* Countdown to first race */}
        {countdown && (
          <div className="border-brutalist p-4 flex flex-col items-center gap-1">
            <span className="text-label-caps text-muted-foreground uppercase">First Race In</span>
            <span className="text-[40px] font-black font-mono leading-none tracking-tight">{countdown}</span>
          </div>
        )}

        {/* Players with submitted indicator */}
        <div className="border-brutalist">
          <div className="px-4 py-2 border-b border-primary/20">
            <span className="text-label-caps uppercase">PLAYERS — {members.length}</span>
          </div>
          {members.map((m, i) => (
            <div
              key={i}
              className={`px-4 py-3 flex items-center justify-between ${i > 0 ? "border-t border-primary/20" : ""}`}
            >
              <span className="text-body-md font-bold uppercase">{m.handle}</span>
              {m.submitted
                ? <span className="text-label-caps uppercase text-primary">✓ PRINTED</span>
                : <span className="text-label-caps uppercase text-muted-foreground opacity-40">PENDING</span>
              }
            </div>
          ))}
        </div>

        {/* Live leaderboard — only show once someone has points */}
        {leaderboard.some(r => r.points > 0) && (
          <div className="border-brutalist">
            <div className="px-4 py-2 border-b border-primary/20">
              <span className="text-label-caps uppercase">Leaderboard</span>
            </div>
            {leaderboard.map((r, i) => (
              <div
                key={r.userId}
                className={`px-4 py-3 flex items-center justify-between ${i > 0 ? "border-t border-primary/20" : ""} ${r.userId === userId ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-label-caps text-muted-foreground w-5">#{i + 1}</span>
                  <span className="text-body-md font-bold uppercase">{r.handle}</span>
                </div>
                <span className="text-headline-md font-black">{r.points}</span>
              </div>
            ))}
          </div>
        )}

        {/* Horse data mode — host can toggle, members see current setting */}
        <div className="border-brutalist flex items-center justify-between px-4 h-14">
          <span className="text-label-caps uppercase">Horse Data</span>
          {userId === scrum.hostId ? (
            <button
              onClick={handleToggleDetails}
              disabled={togglingDetails}
              className={`text-label-caps uppercase px-3 py-1.5 border transition-none disabled:opacity-40 ${(scrum.showDetails ?? true) ? "bg-primary text-primary-foreground border-primary" : "border-primary/40 text-muted-foreground"}`}
            >
              {(scrum.showDetails ?? true) ? "FULL CARD" : "NAME ONLY"}
            </button>
          ) : (
            <span className="text-label-caps uppercase text-muted-foreground">
              {(scrum.showDetails ?? true) ? "FULL CARD" : "NAME ONLY"}
            </span>
          )}
        </div>

        <button
          onClick={() => navigate(`/scrum/${id}/gallop`)}
          className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist transition-none"
        >
          START PICKING →
        </button>

        <Link
          to={`/scrum/${id}/slip`}
          className="w-full h-12 border-brutalist text-label-caps uppercase flex items-center justify-center opacity-60 hover:opacity-100 transition-none"
        >
          SHOW SLIPS
        </Link>

        {/* Host-only results entry */}
        {userId === scrum.hostId && (
          <Link
            to={`/scrum/${id}/host-results`}
            className="w-full h-12 bg-primary text-primary-foreground text-label-caps uppercase flex items-center justify-center border-brutalist transition-none"
          >
            ENTER RESULTS →
          </Link>
        )}

        {/* Leave with confirmation */}
        {confirmLeave ? (
          <div className="border-brutalist p-4 flex flex-col gap-3">
            <p className="text-label-caps uppercase text-center">Are you sure you want to leave?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 h-10 border-brutalist text-label-caps uppercase transition-none"
              >
                CANCEL
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 h-10 bg-destructive text-white text-label-caps uppercase border-brutalist disabled:opacity-40 transition-none"
              >
                {leaving ? "LEAVING…" : "YES, LEAVE"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLeave(true)}
            className="w-full h-12 border-brutalist text-label-caps uppercase opacity-60 hover:opacity-100 transition-none"
          >
            LEAVE GROUP
          </button>
        )}
      </main>
    </div>
  );
};

export default Lobby;
