import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getCrewsForUser, deleteCrew, type Crew } from "@/lib/crews";
import { getFriends, removeFriend, type Friend } from "@/lib/friends";

const Settings = () => {
  const { handle, setHandle, userId } = useAuth();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(handle);
  const inputRef = useRef<HTMLInputElement>(null);

  const [crews, setCrews] = useState<Crew[]>([]);
  const [loadingCrews, setLoadingCrews] = useState(true);
  const [confirmDeleteCrewId, setConfirmDeleteCrewId] = useState<string | null>(null);
  const [deletingCrew, setDeletingCrew] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [confirmRemoveFriendId, setConfirmRemoveFriendId] = useState<string | null>(null);
  const [removingFriend, setRemovingFriend] = useState(false);

  useEffect(() => {
    if (!userId) { setLoadingCrews(false); setLoadingFriends(false); return; }
    getCrewsForUser(userId)
      .then(setCrews).catch(() => {}).finally(() => setLoadingCrews(false));
    getFriends(userId)
      .then(setFriends).catch(() => {}).finally(() => setLoadingFriends(false));
  }, [userId]);

  async function handleRemoveFriend(friendUserId: string) {
    if (!userId) return;
    setRemovingFriend(true);
    try {
      await removeFriend(userId, friendUserId);
      setFriends(prev => prev.filter(f => f.friendUserId !== friendUserId));
      setConfirmRemoveFriendId(null);
      toast.success("Friend removed");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemovingFriend(false);
    }
  }

  async function handleDeleteCrew(crewId: string) {
    setDeletingCrew(true);
    try {
      await deleteCrew(crewId);
      setCrews(prev => prev.filter(c => c.id !== crewId));
      setConfirmDeleteCrewId(null);
      toast.success("Crew deleted");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingCrew(false);
    }
  }

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
        <section style={{ marginBottom: 8 }}>
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

        {/* ── SAVED CREWS ── */}
        <section>
          <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginBottom: 8, letterSpacing: "0.14em" }}>
            SAVED CREWS
          </div>
          {loadingCrews ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", padding: 16, opacity: 0.4 }}>
              <div style={{ height: 8, width: 100, background: "rgba(245,232,223,0.2)" }} />
            </div>
          ) : crews.length === 0 ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", padding: "16px 16px 18px", textAlign: "center" }}>
              <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.4 }}>NO SAVED CREWS</p>
              <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.3, marginTop: 6, fontSize: 10, lineHeight: 1.4 }}>
                SAVE A CREW FROM THE PEN WHILE IN AN ACTIVE GROUP
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {crews.map((crew, i) => (
                <div
                  key={crew.id}
                  style={{
                    border: "3px solid rgba(245,232,223,0.35)",
                    borderBottom: i < crews.length - 1 ? "1.5px solid rgba(245,232,223,0.2)" : "3px solid rgba(245,232,223,0.35)",
                  }}
                >
                  {confirmDeleteCrewId === crew.id ? (
                    <div style={{ padding: "12px 14px" }}>
                      <p className="label-sm" style={{ color: "var(--cream)", marginBottom: 10 }}>
                        DELETE "{crew.name}"?
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setConfirmDeleteCrewId(null)}
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
                          onClick={() => handleDeleteCrew(crew.id)}
                          disabled={deletingCrew}
                          className="label-sm"
                          style={{
                            flex: 1, background: "var(--pink)",
                            border: "1.5px solid var(--ink)", color: "var(--ink)",
                            padding: "8px", cursor: "pointer",
                            opacity: deletingCrew ? 0.4 : 1,
                          }}
                        >
                          {deletingCrew ? "DELETING…" : "YES, DELETE"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <button
                        onClick={() => navigate(`/crew/${crew.id}`)}
                        style={{
                          flex: 1, minWidth: 0, textAlign: "left", background: "transparent",
                          border: 0, cursor: "pointer", padding: "12px 14px",
                        }}
                      >
                        <div className="display" style={{ fontSize: 16, color: "var(--cream)", lineHeight: 1, marginBottom: 4 }}>
                          {crew.name} →
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: "var(--cream)", opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {crew.members.map(m => m.handle).join(", ")}
                        </div>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteCrewId(crew.id)}
                        className="label-sm"
                        style={{
                          background: "transparent", border: 0, color: "var(--cream)",
                          opacity: 0.4, cursor: "pointer", textDecoration: "underline", flexShrink: 0,
                          padding: "12px 14px 12px 0",
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── FRIENDS ── */}
        <section style={{ marginTop: 8 }}>
          <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5, marginBottom: 8, letterSpacing: "0.14em" }}>
            FRIENDS
          </div>
          {loadingFriends ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", padding: 16, opacity: 0.4 }}>
              <div style={{ height: 8, width: 100, background: "rgba(245,232,223,0.2)" }} />
            </div>
          ) : friends.length === 0 ? (
            <div style={{ border: "3px solid rgba(245,232,223,0.35)", padding: "16px 16px 18px", textAlign: "center" }}>
              <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.4 }}>NO FRIENDS SAVED</p>
              <p className="label-sm" style={{ color: "var(--cream)", opacity: 0.3, marginTop: 6, fontSize: 10, lineHeight: 1.4 }}>
                TAP + FRIEND ON A PLAYER IN THE PEN STANDINGS
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {friends.map((friend, i) => (
                <div
                  key={friend.friendUserId}
                  style={{
                    border: "3px solid rgba(245,232,223,0.35)",
                    borderBottom: i < friends.length - 1 ? "1.5px solid rgba(245,232,223,0.2)" : "3px solid rgba(245,232,223,0.35)",
                  }}
                >
                  {confirmRemoveFriendId === friend.friendUserId ? (
                    <div style={{ padding: "12px 14px" }}>
                      <p className="label-sm" style={{ color: "var(--cream)", marginBottom: 10 }}>
                        REMOVE {friend.friendHandle}?
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setConfirmRemoveFriendId(null)}
                          className="label-sm"
                          style={{ flex: 1, background: "transparent", border: "1.5px solid rgba(245,232,223,0.4)", color: "var(--cream)", padding: "8px", cursor: "pointer" }}
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.friendUserId)}
                          disabled={removingFriend}
                          className="label-sm"
                          style={{ flex: 1, background: "var(--pink)", border: "1.5px solid var(--ink)", color: "var(--ink)", padding: "8px", cursor: "pointer", opacity: removingFriend ? 0.4 : 1 }}
                        >
                          {removingFriend ? "REMOVING…" : "YES, REMOVE"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button
                        onClick={() => navigate(`/profile/${friend.friendUserId}`)}
                        style={{ flex: 1, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", padding: "14px" }}
                      >
                        <div className="display" style={{ fontSize: 18, color: "var(--cream)", lineHeight: 1 }}>
                          {friend.friendHandle} →
                        </div>
                      </button>
                      <button
                        onClick={() => setConfirmRemoveFriendId(friend.friendUserId)}
                        className="label-sm"
                        style={{ background: "transparent", border: 0, color: "var(--cream)", opacity: 0.4, cursor: "pointer", textDecoration: "underline", padding: "14px 14px 14px 0", flexShrink: 0 }}
                      >
                        REMOVE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default Settings;
