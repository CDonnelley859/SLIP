import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error trap — writes directly to DOM so we always see crashes
// even if React never mounts
function showCrash(title: string, message: string, stack?: string) {
  document.body.style.cssText = "background:#f5e8df;padding:24px;font-family:monospace";
  document.body.innerHTML = `
    <h2 style="color:#1a1410;font-size:18px;margin-bottom:12px">${title}</h2>
    <pre style="font-size:11px;color:#3a2e25;white-space:pre-wrap;word-break:break-all">${message}${stack ? "\n\n" + stack : ""}</pre>
    <button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;border:2px solid #1a1410;background:transparent;cursor:pointer;font-weight:700">Reload</button>
  `;
}

window.addEventListener("error", (e) => {
  showCrash("JavaScript error", e.message, e.error?.stack);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message ?? String(e.reason);
  showCrash("Unhandled promise rejection", msg, e.reason?.stack);
});

createRoot(document.getElementById("root")!).render(<App />);
