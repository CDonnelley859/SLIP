import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";

const JoinViaLink = () => {
  const { code } = useParams<{ code: string }>();
  const { userId, handle } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Joining…");

  useEffect(() => {
    if (!code || !userId) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "scrums"), where("joinCode", "==", code.toUpperCase()))
        );
        if (snap.empty) { setStatus("Code not found."); return; }
        const scrumId = snap.docs[0].id;
        await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
          scrumId, userId, handle,
        });
        navigate(`/scrum/${scrumId}/lobby`);
      } catch {
        setStatus("Something went wrong. Try entering the code manually.");
      }
    })();
  }, [code, userId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--green)" }}>
      <div style={{ textAlign: "center" }}>
        <p className="label" style={{ color: "var(--cream)", opacity: 0.7 }}>{status}</p>
      </div>
    </div>
  );
};

export default JoinViaLink;
