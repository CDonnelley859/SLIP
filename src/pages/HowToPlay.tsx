import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

type Step = {
  number: number;
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    number: 1,
    title: "WHAT IS SLIP?",
    body: (
      <>
        <p>SLIP is a horse racing pick-em game for you and your mates.</p>
        <p>Pick one horse per race. Score points based on where your horse finishes. Most points at the end of the day wins.</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { pos: "1ST", pts: "5 PTS", color: "var(--pink)" },
            { pos: "2ND", pts: "3 PTS", color: "var(--cream)" },
            { pos: "3RD", pts: "1 PT",  color: "var(--cream)" },
          ].map(r => (
            <div key={r.pos} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              border: "1.5px solid rgba(245,232,223,0.25)", padding: "10px 14px",
            }}>
              <span className="display" style={{ fontSize: 18, color: r.color }}>{r.pos}</span>
              <span className="display" style={{ fontSize: 18, color: r.color }}>{r.pts}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    number: 2,
    title: "TYPES OF GROUPS",
    body: (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "3px solid rgba(245,232,223,0.35)", padding: "16px" }}>
            <div className="display" style={{ fontSize: 18, color: "var(--cream)", marginBottom: 6 }}>ONE TRACK</div>
            <p>Pick a single racecourse. Six races across the day, one horse each. Share a 4-character code with your group. Best total score wins.</p>
          </div>
          <div style={{ border: "3px solid var(--pink)", padding: "16px" }}>
            <div className="display" style={{ fontSize: 18, color: "var(--pink)", marginBottom: 6 }}>MEGA SLIP</div>
            <p>Pick two or more racecourses. Everyone in the group competes across every track at once — a combined leaderboard across all venues.</p>
            <p style={{ marginTop: 8, opacity: 0.6 }}>More tracks = more races = more chaos.</p>
          </div>
        </div>
      </>
    ),
  },
  {
    number: 3,
    title: "CREATING A GROUP",
    body: (
      <>
        <p>On the main screen, tap a track card to select it. It'll turn pink.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { step: "01", text: "Tap one track for a standard group. Tap two or more for a Mega Slip." },
            { step: "02", text: "Give your group a name." },
            { step: "03", text: "You'll get a short join code — send it to whoever's playing." },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--pink)", flexShrink: 0, paddingTop: 2, letterSpacing: "0.1em" }}>{s.step}</span>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    number: 4,
    title: "JOINING A GROUP",
    body: (
      <>
        <p>Got a code from a mate? Enter it in the join box on the main screen.</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ border: "1.5px solid rgba(245,232,223,0.25)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.14em", marginBottom: 4 }}>4-CHARACTER CODE</div>
              <div className="display" style={{ fontSize: 18, color: "var(--cream)" }}>AB12</div>
            </div>
            <div className="label-sm" style={{ color: "var(--cream)", opacity: 0.5 }}>Single track</div>
          </div>
          <div style={{ border: "1.5px solid rgba(245,232,223,0.25)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.14em", marginBottom: 4 }}>6-CHARACTER CODE</div>
              <div className="display" style={{ fontSize: 18, color: "var(--pink)" }}>AB1234</div>
            </div>
            <div className="label-sm" style={{ color: "var(--pink)", opacity: 0.7 }}>Mega Slip</div>
          </div>
        </div>
        <p style={{ marginTop: 16, opacity: 0.6 }}>You can also join via a share link if someone sends you one directly.</p>
      </>
    ),
  },
  {
    number: 5,
    title: "THE PEN",
    body: (
      <>
        <p>Once you're in a group, you land in The Pen — the waiting room before racing starts.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "See who else has joined.",
            "Share the join code so more mates can get in.",
            "Watch the countdown to the first race.",
            "The leaderboard starts filling in as picks come in.",
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--cream)", opacity: 0.4, flexShrink: 0, paddingTop: 2 }}>—</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, opacity: 0.6 }}>You can enter and exit The Pen freely — your picks are saved as you go.</p>
      </>
    ),
  },
  {
    number: 6,
    title: "SAVED CREWS",
    body: (
      <>
        <p>Play with the same group often? Save them as a Crew so you don't have to wait for everyone to join each time.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { step: "01", text: "While you're in an active group, tap SAVE AS CREW at the bottom of The Pen." },
            { step: "02", text: "Give the crew a name. All current members are saved." },
            { step: "03", text: "Next time you create a group, tap + USE A CREW in the form to auto-enrol them all." },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--pink)", flexShrink: 0, paddingTop: 2, letterSpacing: "0.1em" }}>{s.step}</span>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, border: "1.5px solid rgba(245,232,223,0.25)", padding: "12px 14px" }}>
          <p style={{ opacity: 0.65 }}>Crew members don't need to enter a join code — the group appears in their Active Groups automatically when they next open the app.</p>
        </div>
        <p style={{ marginTop: 12, opacity: 0.5 }}>Manage your saved crews any time from Settings.</p>
      </>
    ),
  },
  {
    number: 7,
    title: "THE DAILY GALLOP",
    body: (
      <>
        <p>When the races are close, head to the Daily Gallop. This is where you make your picks.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { step: "01", text: "Swipe or tap the race numbers to move between races." },
            { step: "02", text: "Tap a horse to pick it. You'll feel a buzz." },
            { step: "03", text: "Once a race goes off, that pick is locked — but open races are still fair game." },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--pink)", flexShrink: 0, paddingTop: 2, letterSpacing: "0.1em" }}>{s.step}</span>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, border: "1.5px solid rgba(245,232,223,0.25)", padding: "12px 14px" }}>
          <p style={{ opacity: 0.65 }}>You don't have to pick all six races at once. Come back as each race approaches.</p>
        </div>
      </>
    ),
  },
  {
    number: 8,
    title: "YOUR SLIP",
    body: (
      <>
        <p>Your Slip is your ticket — every pick you've made, with live results as races settle.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "WIN",     desc: "Your horse finished 1st", color: "var(--pink)" },
            { label: "PLACE",   desc: "Your horse finished 2nd", color: "var(--cream)" },
            { label: "SHOW",    desc: "Your horse finished 3rd", color: "var(--cream)" },
            { label: "OUT",     desc: "Better luck next race",   color: "rgba(245,232,223,0.4)" },
            { label: "PENDING", desc: "Race hasn't happened yet",color: "rgba(245,232,223,0.35)" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="display" style={{
                fontSize: 12, border: `2px solid ${r.color}`, color: r.color,
                padding: "3px 8px", flexShrink: 0, minWidth: 64, textAlign: "center",
              }}>{r.label}</span>
              <span className="label-sm" style={{ color: "var(--cream)", opacity: 0.65 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, opacity: 0.6 }}>Swipe left and right to see your group's other slips too.</p>
      </>
    ),
  },
  {
    number: 9,
    title: "THE SPINDLE",
    body: (
      <>
        <p>When all races are done and results are in, finished slips move to the Spindle.</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Flip a card to see the full group standings.",
            "Mega Slip groups show a combined leaderboard across all tracks.",
            "Your final rank and score are saved to your Form.",
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--cream)", opacity: 0.4, flexShrink: 0, paddingTop: 2 }}>—</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, border: "3px solid rgba(245,232,223,0.35)", padding: "18px", textAlign: "center" }}>
          <div className="display" style={{ fontSize: 22, color: "var(--pink)", marginBottom: 6 }}>THAT'S IT.</div>
          <p style={{ opacity: 0.7 }}>Pick your horses. Beat your mates. Pour one out for the ones that didn't place.</p>
        </div>
      </>
    ),
  },
];

const HowToPlay = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [slideKey, setSlideKey] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function go(dir: "forward" | "back") {
    if (dir === "forward" && step >= STEPS.length - 1) return;
    if (dir === "back" && step <= 0) return;
    setSlideDir(dir);
    setSlideKey(k => k + 1);
    setStep(s => dir === "forward" ? s + 1 : s - 1);
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) go("forward");
    if (dx > 0) go("back");
  }

  return (
    <div
      className="min-h-screen halftone-bg"
      style={{ background: "var(--green)", display: "flex", flexDirection: "column" }}
    >
      {/* ── HEADER ── */}
      <header style={{
        background: "var(--green)", borderBottom: "3px solid rgba(245,232,223,0.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, padding: "0 18px", flexShrink: 0,
      }}>
        <Link to="/settings" className="label" style={{ color: "var(--cream)", textDecoration: "none" }}>
          ← SETTINGS
        </Link>
        <span className="display" style={{ fontSize: 22, color: "var(--cream)" }}>HOW TO PLAY</span>
        <div style={{ width: 80 }} />
      </header>

      {/* ── STEP CARD ── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 18px 100px", overflow: "hidden" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" custom={slideDir}>
        <motion.div
          key={slideKey}
          custom={slideDir}
          variants={{
            enter: (dir: string) => ({ x: dir === "forward" ? 40 : -40, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (dir: string) => ({ x: dir === "forward" ? -40 : 40, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.25, 0, 0.25, 1] }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {/* step number */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span className="display" style={{ fontSize: 56, lineHeight: 1, color: "var(--pink)" }}>
              {String(current.number).padStart(2, "0")}
            </span>
            <div style={{ height: 3, flex: 1, background: "rgba(245,232,223,0.2)" }}>
              <div style={{
                height: "100%",
                width: `${((step + 1) / STEPS.length) * 100}%`,
                background: "var(--pink)", transition: "width 300ms ease",
              }} />
            </div>
          </div>

          {/* card */}
          <div style={{
            border: "3px solid rgba(245,232,223,0.35)", background: "var(--green)", flex: 1,
            padding: "22px 20px", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 12,
            color: "var(--cream)",
          }}>
            <div className="display" style={{ fontSize: 26, lineHeight: 1, marginBottom: 4, color: "var(--cream)" }}>
              {current.title}
            </div>
            <div className="label-sm" style={{ display: "flex", flexDirection: "column", gap: 10, color: "var(--cream)", opacity: 0.85 }}>
              {current.body}
            </div>
          </div>
        </motion.div>
        </AnimatePresence>
      </div>

      {/* ── FIXED FOOTER ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--green)", borderTop: "3px solid rgba(245,232,223,0.3)",
        padding: "14px 18px 24px",
      }}>
        {/* Dot indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (i === step) return;
                setSlideDir(i > step ? "forward" : "back");
                setSlideKey(k => k + 1);
                setStep(i);
              }}
              style={{
                width: i === step ? 20 : 8, height: 8,
                borderRadius: 4,
                background: i === step ? "var(--cream)" : "rgba(245,232,223,0.3)",
                border: 0, cursor: "pointer",
                transition: "width 200ms ease, background 200ms ease",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => go("back")}
              className="display"
              style={{
                flex: 1, border: "3px solid rgba(245,232,223,0.35)", background: "transparent",
                color: "var(--cream)", padding: "14px", cursor: "pointer",
                fontSize: 16, letterSpacing: "0.06em",
              }}
            >
              ← BACK
            </button>
          )}
          <button
            onClick={() => isLast ? navigate("/settings") : go("forward")}
            className="display"
            style={{
              flex: step > 0 ? 2 : 1,
              border: "3px solid var(--ink)",
              background: isLast ? "var(--pink)" : "var(--cream)",
              color: "var(--ink)", padding: "14px", cursor: "pointer",
              fontSize: 16, letterSpacing: "0.06em",
            }}
          >
            {isLast ? "DONE" : "NEXT →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;
