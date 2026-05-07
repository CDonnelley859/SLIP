import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

const Stalls = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [scrum, setScrum] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [horseCount, setHorseCount] = useState(0);

  useEffect(() => {
    if (!user || !id) return;
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
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <PageShell title="The Stalls">
      {scrum && card && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{card.trackName}</div>
            <h2 className="font-display text-2xl mt-1">{scrum.name}</h2>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-xs text-muted-foreground">Join code</div>
                <div className="font-mono brass-text text-xl tracking-widest">{scrum.joinCode}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Post Time</div>
                <div className="font-mono text-sm">
                  {card.postTime && formatDistanceToNow(new Date(card.postTime), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Lineup ({members.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 bg-card rounded-full pl-1 pr-3 py-1 border border-border">
                  <div className="h-6 w-6 rounded-full" style={{ background: m.profile?.capColor ?? "#c9a84c" }} />
                  <span className="text-sm">@{m.profile?.handle}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">{horseCount} horses across the card</div>

          <Link to={`/scrum/${id}/gallop`}>
            <Button className="w-full font-display text-lg" size="lg">Enter the Daily Gallop</Button>
          </Link>
        </div>
      )}
    </PageShell>
  );
};

export default Stalls;
