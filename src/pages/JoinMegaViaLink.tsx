import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { joinMegaSlip } from "@/lib/megaSlip";

const JoinMegaViaLink = () => {
  const { code } = useParams();
  const { userId, handle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code || !userId || !handle) return;
    joinMegaSlip(code, userId, handle)
      .then(megaSlipId => navigate(`/mega/${megaSlipId}/hub`, { replace: true }))
      .catch(err => setError(err.message ?? "Invalid code"));
  }, [code, userId, handle]);

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--green)", padding: 24 }}>
      <p className="label" style={{ color: "var(--cream)", marginBottom: 16 }}>{error}</p>
      <button onClick={() => navigate("/")} className="label" style={{ background: "transparent", border: 0, color: "var(--cream)", textDecoration: "underline", cursor: "pointer" }}>
        ← HOME
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--green)" }}>
      <p className="label" style={{ color: "var(--cream)", opacity: 0.6 }}>Joining…</p>
    </div>
  );
};

export default JoinMegaViaLink;
