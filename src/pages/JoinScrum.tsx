import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Page, PageBody, PageHeader, FieldGroup, SubmitButton } from "@/components/slip";

const JoinScrum = () => {
  const { userId, handle } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [playerName, setPlayerName] = useState(handle);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const snap = await getDocs(
        query(collection(db, "scrums"), where("joinCode", "==", code.toUpperCase().trim()))
      );
      if (snap.empty) throw new Error("Code not found");
      const scrumId = snap.docs[0].id;
      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: playerName.trim() || handle,
      });
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || code.length < 4 || !playerName.trim();

  return (
    <Page>
      <PageHeader title="JOIN GROUP" />
      <PageBody>
        <form onSubmit={join}>
          <FieldGroup
            fields={[
              { label: "GROUP CODE", value: code, onChange: setCode, code: true, autoFocus: true, required: true, placeholder: "XXXX", maxLength: 4 },
              { label: "YOUR NAME", value: playerName, onChange: setPlayerName, required: true, placeholder: "YOUR NAME IN THIS GROUP", maxLength: 30 },
            ]}
          />
          <SubmitButton disabled={disabled}>{busy ? "JOINING…" : "JOIN"}</SubmitButton>
        </form>
      </PageBody>
    </Page>
  );
};

export default JoinScrum;
