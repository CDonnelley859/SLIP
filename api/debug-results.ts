import type { VercelRequest, VercelResponse } from "@vercel/node";

const OH_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const OH_BASE = "https://api.ourhub.site";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const RAPID_HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const tests: Array<{ label: string; url: string; headers: Record<string, string> }> = [
    // OurHub — try every plausible result path
    { label: "OH result-info", url: `${OH_BASE}/api/result-info/${date}`, headers: { "X-API-Key": OH_KEY } },
    { label: "OH results", url: `${OH_BASE}/api/results/${date}`, headers: { "X-API-Key": OH_KEY } },
    { label: "OH result", url: `${OH_BASE}/api/result/${date}`, headers: { "X-API-Key": OH_KEY } },
    { label: "OH runner-info (check for position fields)", url: `${OH_BASE}/api/runner-info/${date}`, headers: { "X-API-Key": OH_KEY } },
    // RapidAPI — try results endpoints
    { label: "RapidAPI results today", url: `https://${RAPID_HOST}/results`, headers: RAPID_HEADERS },
    { label: "RapidAPI results date", url: `https://${RAPID_HOST}/results?date=${date}`, headers: RAPID_HEADERS },
    { label: "RapidAPI races today", url: `https://${RAPID_HOST}/races?date=${date}`, headers: RAPID_HEADERS },
  ];

  const out: Record<string, any> = {};

  for (const t of tests) {
    try {
      const r = await fetch(t.url, { headers: t.headers });
      const text = await r.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text; }

      // For runner-info, check if any entries have a position field
      let positionSample: any = null;
      if (t.label.includes("runner-info") && typeof body === "object") {
        const firstKey = Object.keys(body)[0];
        if (firstKey && Array.isArray(body[firstKey])) {
          positionSample = body[firstKey][0]; // First runner in first race
        }
      }

      out[t.label] = {
        status: r.status,
        sample: JSON.stringify(body).slice(0, 400),
        ...(positionSample ? { firstRunner: positionSample } : {}),
      };
    } catch (e: any) {
      out[t.label] = { error: e.message };
    }
  }

  res.json(out);
}
