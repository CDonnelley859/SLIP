import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";

const Stalls = () => {
  const { id } = useParams();
  const { userId } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [horseCount, setHorseCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const scrumSnap = await getDoc(doc(db, "scrums", id));
      if (!scrumSnap.exists()) return;
      const scrumData = scrumSnap.data();
      setScrum(scrumData);

      const cardSnap = await getDoc(doc(db, "cards", scrumData.cardId));
      if (cardSnap.exists()) setCard(cardSnap.data());

      const membersSnap = await getDocs(collection(db, "scrums", id, "members"));
      const memberList: any[] = [];
      for (const m of membersSnap.docs) {
        const profileSnap = await getDoc(doc(db, "users", m.data().userId));
        memberList.push({ ...m.data(), profile: profileSnap.data() });
      }
      setMembers(memberList);

      const racesSnap = await getDocs(collection(db, "cards", scrumData.cardId, "races"));
      let count = 0;
      for (const r of racesSnap.docs) {
        const horsesSnap = await getDocs(collection(db, "cards", scrumData.cardId, "races", r.id, "horses"));
        count += horsesSnap.size;
      }
      setHorseCount(count);
    })();
  }, [id]);

  return (
    <div className="min-h-screen" style={{ background: "var(--green)" }}>
      <header
        style={{
          background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.25)",
          display: "flex", alignItems: "center", height: 64, padding: "0 18px",
          position: "sticky", top: 0, zIndex: 50,
        }}
      >
        <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>← PADDOCK</Link>
        <span className="display" style={{ fontSize: 20, color: "var(--cream)", margin: "0 auto" }}>THE STALLS</span>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: "24px 18px 80px", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {scrum && card && (
          <>
            <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "14px 16px" }}>
              <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>{card.trackName}</div>
              <div className="display" style={{ fontSize: 28, color: "var(--cream)", marginTop: 4 }}>{scrum.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                <div>
                  <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>JOIN CODE</div>
                  <div className="mono" style={{ fontSize: 22, letterSpacing: "0.2em", color: "var(--cream)", marginTop: 2 }}>{scrum.joinCode}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>POST TIME</div>
                  <div className="mono" style={{ fontSize: 13, color: "var(--cream)", marginTop: 2 }}>
                    {card.postTime && formatDistanceToNow(new Date(card.postTime), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ border: "3px solid rgba(245,232,223,0.25)", background: "var(--green)", padding: "14px 16px" }}>
              <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.7, marginBottom: 10 }}>LINEUP ({members.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {members.map((m) => (
                  <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid rgba(245,232,223,0.3)", padding: "4px 10px 4px 4px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: m.profile?.capColor ?? "var(--pink)", flexShrink: 0 }} />
                    <span className="label-sm" style={{ color: "var(--cream)" }}>@{m.profile?.handle ?? m.userId.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>{horseCount} HORSES ACROSS THE CARD</p>

            <Link
              to={`/scrum/${id}/gallop`}
              className="btn-retro btn-retro-pink"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              ENTER THE DAILY GALLOP →
            </Link>
          </>
        )}
      </main>
    </div>
  );
};

export default Stalls;
