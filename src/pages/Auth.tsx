import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Auth = () => {
  const { user, loading, signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const resolvedHandle = handle.trim() || `jockey_${Math.random().toString(36).slice(2, 8)}`;
        await signUp(email, password, resolvedHandle);
        toast.success("Welcome to the paddock");
        navigate("/");
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--green)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="display" style={{ fontSize: 64, color: "var(--cream)" }}>SLIP</h1>
          <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.6, marginTop: 8 }}>Race-Day Companion</p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
              <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>HANDLE</div>
              <input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="YOUR JOCKEY NAME" className="mono" style={{ width: "100%", border: 0, background: "transparent", padding: "14px", fontSize: 14, textTransform: "uppercase", color: "var(--cream)", outline: "none" }} />
            </div>
          )}
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
            <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>EMAIL</div>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="mono" style={{ width: "100%", border: 0, background: "transparent", padding: "14px", fontSize: 14, color: "var(--cream)", outline: "none" }} />
          </div>
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", position: "relative" }}>
            <div className="label-sm" style={{ position: "absolute", top: -1, left: 12, transform: "translateY(-50%)", background: "var(--green)", padding: "0 4px", color: "var(--cream)" }}>PASSWORD</div>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mono" style={{ width: "100%", border: 0, background: "transparent", padding: "14px", fontSize: 14, color: "var(--cream)", outline: "none" }} />
          </div>
          <button type="submit" disabled={busy} className="display" style={{ background: busy ? "rgba(245,232,223,0.25)" : "var(--cream)", color: busy ? "rgba(245,232,223,0.5)" : "var(--ink)", border: 0, padding: "16px", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", width: "100%", textTransform: "uppercase" }}>
            {busy ? "…" : mode === "signin" ? "ENTER THE PADDOCK" : "CREATE ACCOUNT"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="label-sm"
          style={{ width: "100%", textAlign: "center", color: "var(--cream)", opacity: 0.55, marginTop: 20, background: "transparent", border: 0, cursor: "pointer" }}
        >
          {mode === "signin" ? "NEW JOCKEY? SIGN UP" : "ALREADY RACING? SIGN IN"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
