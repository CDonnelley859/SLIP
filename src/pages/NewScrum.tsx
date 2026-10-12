import { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

import { uniqueJoinCode } from "@/lib/codes";
import { Page, PageBody, PageHeader, FieldGroup, SubmitButton } from "@/components/slip";

const NewScrum = () => {
  const { userId, handle } = useAuth();
  const [params] = useSearchParams();
  const cardId = params.get("card");
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState(handle);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!cardId) return <Navigate to="/" replace />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const joinCode = await uniqueJoinCode("scrums", 4);
      const scrumId = crypto.randomUUID();

      await setDoc(doc(db, "scrums", scrumId), {
        cardId,
        hostId: userId,
        name: name.trim(),
        joinCode,
      });

      await setDoc(doc(db, "scrumMembers", `${scrumId}_${userId}`), {
        scrumId, userId, handle: playerName.trim() || handle,
      });

      toast.success(`Group code: ${joinCode}`);
      navigate(`/scrum/${scrumId}/lobby`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !name.trim() || !playerName.trim();

  return (
    <Page>
      <PageHeader title="NEW GROUP" />
      <PageBody>
        <form onSubmit={create}>
          <FieldGroup
            fields={[
              { label: "GROUP NAME", value: name, onChange: setName, autoFocus: true, required: true, placeholder: "THE SATURDAY CREW", maxLength: 40 },
              { label: "YOUR NAME", value: playerName, onChange: setPlayerName, required: true, placeholder: "YOUR NAME IN THIS GROUP", maxLength: 30 },
            ]}
          />
          <SubmitButton disabled={disabled}>{busy ? "CREATING…" : "CREATE GROUP"}</SubmitButton>
        </form>
        <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginTop: 16, textAlign: "center" }}>
          A JOIN CODE WILL BE GENERATED FOR YOU TO SHARE
        </p>
      </PageBody>
    </Page>
  );
};

export default NewScrum;
