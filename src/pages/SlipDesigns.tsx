import { Link } from "react-router-dom";

const TRACK = "CHESTER";
const GROUP = "THE SATURDAY CREW";
const DATE = "8 MAY 2026";
const PICKS = [
  { race: "01", horse: "GOLDEN ARROW", time: "13:30" },
  { race: "02", horse: "DARK KNIGHT", time: "14:05" },
  { race: "03", horse: "SILVER SPIRE", time: "14:40" },
  { race: "04", horse: "IRON FIST", time: "15:15" },
];

// ─── Shared notch helper ──────────────────────────────────────────────────────
const Notch = ({ side, top, bg = "#f0f0f0" }: { side: "left" | "right"; top: string; bg?: string }) => (
  <div style={{
    position: "absolute",
    [side]: -11,
    top,
    width: 22, height: 22,
    borderRadius: "50%",
    background: bg,
    border: "2px solid #111",
    zIndex: 10,
    boxSizing: "border-box",
    clipPath: side === "left"
      ? "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)"
      : "polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)",
  }} />
);

// ─── Design 1: Classic Horizontal — main body + right stub ───────────────────
const Design1 = () => (
  <div className="relative flex bg-white border-[2.67px] border-black overflow-visible" style={{ minHeight: 160 }}>
    {/* Main body */}
    <div className="flex-1 p-4 flex flex-col justify-between">
      <div>
        <div className="text-[9px] font-mono uppercase text-gray-400 tracking-widest">{DATE}</div>
        <div className="text-[28px] font-black uppercase leading-none mt-1">{TRACK}</div>
        <div className="text-[10px] uppercase text-gray-500 mt-1">{GROUP}</div>
      </div>
      <div className="flex gap-3 mt-3">
        {PICKS.slice(0, 3).map(p => (
          <div key={p.race} className="flex-1 border border-black/20 p-1">
            <div className="text-[8px] text-gray-400 font-mono">R{p.race}</div>
            <div className="text-[9px] font-bold uppercase leading-tight">{p.horse}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Perforation */}
    <div className="relative flex flex-col items-center justify-center" style={{ width: 1 }}>
      <Notch side="left" top="-11px" bg="#e5e5e5" />
      <div style={{ height: "100%", borderLeft: "2px dashed #aaa" }} />
      <Notch side="left" top="calc(100% - 11px)" bg="#e5e5e5" />
    </div>

    {/* Stub */}
    <div className="flex flex-col items-center justify-between py-4 px-3" style={{ width: 64 }}>
      <div className="text-[8px] font-mono uppercase tracking-widest text-gray-400">SLIP</div>
      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        className="text-[13px] font-black uppercase tracking-widest">ADMIT ONE</div>
      <div className="text-[8px] font-mono text-gray-400">#{PICKS.length}</div>
    </div>
  </div>
);

// ─── Design 2: Portrait with top header stub ─────────────────────────────────
const Design2 = () => (
  <div className="relative bg-white border-[2.67px] border-black overflow-visible" style={{ minWidth: 220 }}>
    {/* Header stub */}
    <div className="px-4 py-3 flex justify-between items-center">
      <div>
        <div className="text-[8px] font-mono text-gray-400 uppercase">{DATE}</div>
        <div className="text-[11px] font-black uppercase">{GROUP}</div>
      </div>
      <div className="text-[10px] font-mono uppercase text-right text-gray-500">
        ADMIT<br />ONE
      </div>
    </div>

    {/* Perforation */}
    <div className="relative" style={{ height: 1 }}>
      <Notch side="left" top="-11px" bg="#e5e5e5" />
      <div style={{ borderTop: "2px dashed #aaa", margin: "0 0" }} />
      <Notch side="right" top="-11px" bg="#e5e5e5" />
    </div>

    {/* Main body */}
    <div className="p-4">
      <div className="text-[32px] font-black uppercase leading-none">{TRACK}</div>
      <div className="mt-3 space-y-2">
        {PICKS.map(p => (
          <div key={p.race} className="flex justify-between items-center border-b border-black/10 pb-1">
            <span className="text-[9px] font-mono text-gray-400">RACE {p.race} · {p.time}</span>
            <span className="text-[11px] font-bold uppercase">{p.horse}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Design 3: Double stub top + bottom ──────────────────────────────────────
const Design3 = () => (
  <div className="relative bg-white border-[2.67px] border-black overflow-visible">
    {/* Top stub */}
    <div className="px-5 py-2 flex justify-between items-center">
      <span className="text-[8px] font-mono uppercase tracking-widest text-gray-400">{DATE}</span>
      <span className="text-[8px] font-mono uppercase tracking-widest text-gray-400">SLIP</span>
    </div>

    {/* Top perf */}
    <div className="relative" style={{ height: 1 }}>
      <Notch side="left" top="-11px" bg="#e5e5e5" />
      <div style={{ borderTop: "2px dashed #999" }} />
      <Notch side="right" top="-11px" bg="#e5e5e5" />
    </div>

    {/* Body */}
    <div className="p-5">
      <div className="text-[30px] font-black uppercase leading-none">{TRACK}</div>
      <div className="text-[10px] uppercase text-gray-500 mb-3">{GROUP}</div>
      <div className="space-y-1">
        {PICKS.map(p => (
          <div key={p.race} className="flex items-center gap-3">
            <span className="text-[9px] font-mono bg-black text-white px-1">{p.race}</span>
            <span className="text-[11px] font-bold uppercase">{p.horse}</span>
            <span className="text-[9px] font-mono text-gray-400 ml-auto">{p.time}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom perf */}
    <div className="relative" style={{ height: 1 }}>
      <Notch side="left" top="-11px" bg="#e5e5e5" />
      <div style={{ borderTop: "2px dashed #999" }} />
      <Notch side="right" top="-11px" bg="#e5e5e5" />
    </div>

    {/* Bottom stub */}
    <div className="px-5 py-3 flex justify-between items-center">
      <span className="text-[10px] font-black uppercase">{PICKS.length} SELECTIONS</span>
      <span className="text-[8px] font-mono uppercase text-gray-400">KEEP THIS TICKET</span>
    </div>
  </div>
);

// ─── Design 4: Vintage wide — dashed outer border, badge centre ───────────────
const Design4 = () => (
  <div className="relative bg-white p-[3px]" style={{ border: "2.67px solid black" }}>
    <div className="border border-dashed border-black p-4 flex gap-4">
      {/* Left block */}
      <div className="flex flex-col justify-between pr-4" style={{ borderRight: "2px dashed #aaa", minWidth: 130 }}>
        <div>
          <div className="text-[8px] font-mono uppercase text-gray-400 tracking-widest">{DATE}</div>
          <div className="text-[26px] font-black uppercase leading-tight">{TRACK}</div>
          <div className="text-[9px] uppercase text-gray-500">{GROUP}</div>
        </div>
        <div className="flex gap-1 mt-2">
          {["★", "★", "★"].map((s, i) => <span key={i} className="text-[10px]">{s}</span>)}
        </div>
      </div>

      {/* Notches on perf */}
      <Notch side="left" top="calc(50% - 11px)" bg="#f0f0f0" />
      <Notch side="right" top="calc(50% - 11px)" bg="#f0f0f0" />

      {/* Right block — picks */}
      <div className="flex-1">
        <div className="text-[8px] font-mono uppercase text-gray-400 mb-2">SELECTIONS</div>
        {PICKS.map(p => (
          <div key={p.race} className="flex justify-between text-[10px] border-b border-dotted border-black/20 py-0.5">
            <span className="font-mono text-gray-400">R{p.race}</span>
            <span className="font-bold uppercase">{p.horse}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Design 5: Dark / inverse ─────────────────────────────────────────────────
const Design5 = () => (
  <div className="relative overflow-visible" style={{ background: "#111", border: "2.67px solid #111", color: "#f0f0f0" }}>
    {/* Header */}
    <div className="px-5 pt-5 pb-3 flex justify-between items-start">
      <div>
        <div className="text-[8px] font-mono tracking-widest" style={{ color: "#888" }}>{DATE}</div>
        <div className="text-[28px] font-black uppercase leading-none">{TRACK}</div>
        <div className="text-[9px] uppercase" style={{ color: "#888" }}>{GROUP}</div>
      </div>
      <div className="text-[9px] font-mono uppercase text-right" style={{ color: "#888" }}>
        ADMIT<br />ONE
      </div>
    </div>

    {/* Perforation */}
    <div className="relative" style={{ height: 1 }}>
      <Notch side="left" top="-11px" bg="#333" />
      <div style={{ borderTop: "2px dashed #444" }} />
      <Notch side="right" top="-11px" bg="#333" />
    </div>

    {/* Picks */}
    <div className="px-5 py-4 space-y-2">
      {PICKS.map(p => (
        <div key={p.race} className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono px-1" style={{ background: "#f0f0f0", color: "#111" }}>R{p.race}</span>
            <span className="text-[11px] font-bold uppercase">{p.horse}</span>
          </div>
          <span className="text-[9px] font-mono" style={{ color: "#888" }}>{p.time}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Design 6: Tall portrait, side stub right ─────────────────────────────────
const Design6 = () => (
  <div className="relative flex bg-white border-[2.67px] border-black overflow-visible" style={{ minHeight: 240 }}>
    {/* Main */}
    <div className="flex-1 p-4 flex flex-col">
      <div className="text-[8px] font-mono text-gray-400 uppercase tracking-widest">{DATE}</div>
      <div className="text-[32px] font-black uppercase leading-none mt-1">{TRACK}</div>
      <div className="text-[9px] text-gray-500 uppercase mb-4">{GROUP}</div>
      <div className="flex-1 space-y-2">
        {PICKS.map(p => (
          <div key={p.race} className="border border-black/15 p-2">
            <div className="text-[8px] font-mono text-gray-400">RACE {p.race} · {p.time}</div>
            <div className="text-[12px] font-black uppercase">{p.horse}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Perf */}
    <div className="relative flex flex-col justify-center" style={{ width: 1 }}>
      <Notch side="left" top="-11px" bg="#e5e5e5" />
      <div style={{ height: "100%", borderLeft: "2px dashed #aaa" }} />
      <Notch side="left" top="calc(100% - 11px)" bg="#e5e5e5" />
    </div>

    {/* Stub */}
    <div className="flex flex-col items-center justify-between py-4 px-2" style={{ width: 48, background: "#111", color: "#f0f0f0" }}>
      <span className="text-[7px] font-mono uppercase tracking-widest" style={{ writingMode: "vertical-rl" }}>{DATE}</span>
      <span className="text-[12px] font-black uppercase" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.2em" }}>SLIP</span>
      <span className="text-[7px] font-mono uppercase" style={{ writingMode: "vertical-rl" }}>{PICKS.length} PICKS</span>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const SlipDesigns = () => (
  <div className="min-h-screen bg-background pb-20">
    <header className="bg-background border-b-brutalist flex items-center justify-between h-16 px-4 sticky top-0 z-50">
      <Link to="/" className="text-label-caps uppercase">← BACK</Link>
      <h1 className="text-headline-md uppercase">SLIP DESIGNS</h1>
      <div className="w-20" />
    </header>

    <main className="px-4 pt-6 space-y-10 max-w-lg mx-auto">
      {[
        { n: 1, label: "Horizontal + right stub", el: <Design1 /> },
        { n: 2, label: "Portrait + top tear", el: <Design2 /> },
        { n: 3, label: "Double stub, top & bottom", el: <Design3 /> },
        { n: 4, label: "Vintage wide, dashed border", el: <Design4 /> },
        { n: 5, label: "Dark / inverse", el: <Design5 /> },
        { n: 6, label: "Tall portrait + dark stub", el: <Design6 /> },
      ].map(({ n, label, el }) => (
        <div key={n}>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-[32px] font-black leading-none">{n}</span>
            <span className="text-label-caps uppercase text-muted-foreground">{label}</span>
          </div>
          <div className="overflow-visible px-2">{el}</div>
        </div>
      ))}
    </main>
  </div>
);

export default SlipDesigns;
