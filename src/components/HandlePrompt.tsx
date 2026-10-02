import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

// Shown on invite-link pages when the visitor has no display name yet.
export const HandlePrompt = ({ title = "WHAT DO THEY CALL YOU?" }: { title?: string }) => {
  const { setHandle } = useAuth();
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) setHandle(value.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--green)" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320 }}>
        <p className="label" style={{ color: "var(--cream)", textAlign: "center", marginBottom: 16 }}>{title}</p>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="YOUR NAME"
          maxLength={30}
          className="mono"
          style={{
            width: "100%", border: "3px solid rgba(245,232,223,0.35)", background: "transparent",
            padding: "14px", fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--cream)", outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="display"
          style={{
            width: "100%", padding: 16, fontSize: 18, border: 0, textTransform: "uppercase",
            cursor: "pointer",
            background: value.trim() ? "var(--cream)" : "rgba(245,232,223,0.25)",
            color: value.trim() ? "var(--ink)" : "rgba(245,232,223,0.5)",
          }}
        >
          JOIN
        </button>
      </form>
    </div>
  );
};
