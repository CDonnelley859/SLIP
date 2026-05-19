import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Settings = () => {
  const { handle, setHandle } = useAuth();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(handle);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setNameInput(handle);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) { toast.error("Name can't be empty"); return; }
    setHandle(trimmed);
    setEditingName(false);
    toast.success("Name updated");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") saveName();
    if (e.key === "Escape") setEditingName(false);
  }

  return (
    <div className="min-h-screen halftone-bg" style={{ background: "var(--green)" }}>

      {/* ── HEADER ── */}
      <header style={{
        background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, padding: "0 18px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link to="/" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>
          ← PADDOCK
        </Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>SETTINGS</span>
        <div style={{ width: 80 }} />
      </header>

      <main style={{ padding: "24px 18px 80px", maxWidth: 420, margin: "0 auto" }}>

        {/* ── DISPLAY NAME ── */}
        <section style={{ marginBottom: 8 }}>
          <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginBottom: 8, letterSpacing: "0.14em" }}>
            YOUR PROFILE
          </div>
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", background: "var(--green)" }}>
            {editingName ? (
              <div style={{ padding: "14px 16px" }}>
                <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.55, marginBottom: 8 }}>DISPLAY NAME</div>
                <input
                  ref={inputRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={30}
                  className="mono"
                  style={{
                    width: "100%", background: "transparent",
                    border: 0, borderBottom: "1.5px solid rgba(245,232,223,0.4)",
                    color: "var(--cream)", fontSize: 16, padding: "6px 0",
                    outline: "none", letterSpacing: "0.08em", textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setEditingName(false)}
                    className="label-sm"
                    style={{
                      flex: 1, background: "transparent",
                      border: "1.5px solid rgba(245,232,223,0.4)", color: "var(--cream)",
                      padding: "8px", cursor: "pointer",
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={saveName}
                    className="label-sm"
                    style={{
                      flex: 1, background: "var(--cream)",
                      border: "1.5px solid var(--ink)", color: "var(--ink)",
                      padding: "8px", cursor: "pointer", fontWeight: 700,
                    }}
                  >
                    SAVE
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startEdit}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: 0,
                  padding: "16px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.55, marginBottom: 4 }}>DISPLAY NAME</div>
                  <div className="display" style={{ fontSize: 24, color: "var(--cream)", lineHeight: 1 }}>
                    {handle || "— NOT SET —"}
                  </div>
                </div>
                <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>EDIT →</span>
              </button>
            )}
          </div>
        </section>

        {/* ── YOUR FORM ── */}
        <section style={{ marginBottom: 8 }}>
          <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginBottom: 8, letterSpacing: "0.14em" }}>
            STATS
          </div>
          <button
            onClick={() => navigate("/stats")}
            style={{
              width: "100%", textAlign: "left", background: "var(--green)",
              border: "3px solid rgba(245,232,223,0.35)", padding: "16px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div>
              <div className="display" style={{ fontSize: 20, color: "var(--cream)", lineHeight: 1, marginBottom: 4 }}>
                YOUR FORM
              </div>
              <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>
                Wins, points, and your best finish
              </div>
            </div>
            <span className="display" style={{ fontSize: 20, color: "var(--cream)", opacity: 0.5 }}>→</span>
          </button>
        </section>

        {/* ── HOW TO PLAY ── */}
        <section>
          <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginBottom: 8, letterSpacing: "0.14em" }}>
            HELP
          </div>
          <button
            onClick={() => navigate("/how-to-play")}
            style={{
              width: "100%", textAlign: "left", background: "var(--green)",
              border: "3px solid rgba(245,232,223,0.35)", padding: "16px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div>
              <div className="display" style={{ fontSize: 20, color: "var(--cream)", lineHeight: 1, marginBottom: 4 }}>
                HOW TO PLAY
              </div>
              <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>
                Groups, picking horses, scoring — the full rundown
              </div>
            </div>
            <span className="display" style={{ fontSize: 20, color: "var(--cream)", opacity: 0.5 }}>→</span>
          </button>
        </section>

      </main>
    </div>
  );
};

export default Settings;
