import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mascot } from "@/components/Mascot";

const KEY = "slip-splash-seen";

const seen = () => {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
};

/** One-time-per-session opening screen: the mascot gallops in, tap to skip. */
export const Splash = () => {
  const [open, setOpen] = useState(() => !seen());

  useEffect(() => {
    if (!open) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    const t = setTimeout(() => setOpen(false), 2600);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="splash"
          role="button"
          aria-label="Skip intro"
          onClick={() => setOpen(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, background: "var(--green)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            cursor: "pointer", overflow: "hidden",
          }}
        >
          <div className="harlequin harlequin-sm" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 40, borderBottom: "3px solid var(--ink)" }} />
          <div className="harlequin harlequin-sm" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, borderTop: "3px solid var(--ink)" }} />

          <motion.div
            initial={{ x: "-110vw" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 70, damping: 14, mass: 1.1 }}
          >
            <Mascot size={Math.min(320, typeof window !== "undefined" ? window.innerWidth - 40 : 320)} />
          </motion.div>

          <motion.h1
            className="display-extruded"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            style={{ fontSize: 88, color: "var(--cream)", margin: "8px 0 0" }}
          >
            SLIP
          </motion.h1>
          <motion.p
            className="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            style={{ color: "var(--cream)", marginTop: 10 }}
          >
            PICK YOUR HORSES · BEAT YOUR MATES
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Splash;
