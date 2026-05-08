import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, deleteDoc,
} from "firebase/firestore";

const Lobby = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);

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
      setMembers(membersSnap.docs.map(d => d.data().handle ?? "Anonymous"));
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

        <div className="border-brutalist p-6 flex flex-col items-center gap-2">
          <span className="text-label-caps text-muted-foreground uppercase">JOIN CODE</span>
          <span className="text-[56px] font-black tracking-[0.2em] font-mono leading-none">{scrum.joinCode}</span>
          <span className="text-label-caps text-muted-foreground uppercase mt-1">Share with your group</span>
        </div>

        <div className="border-brutalist">
          <div className="px-4 py-2 border-b border-primary/20">
            <span className="text-label-caps uppercase">PLAYERS — {members.length}</span>
          </div>
          {members.map((m, i) => (
            <div key={i} className={`px-4 py-3 text-body-md font-bold uppercase ${i > 0 ? "border-t border-primary/20" : ""}`}>
              {m}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate(`/scrum/${id}/gallop`)}
          className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist transition-none"
        >
          START PICKING →
        </button>

        <button
          onClick={handleLeave}
          disabled={leaving}
          className="w-full h-12 border-brutalist text-label-caps uppercase opacity-60 hover:opacity-100 disabled:opacity-30 transition-none"
        >
          {leaving ? "LEAVING…" : "LEAVE GROUP"}
        </button>
      </main>
    </div>
  );
};

export default Lobby;
