import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, {
    headers: {
      "x-rapidapi-key": RAPID_KEY,
      "x-rapidapi-host": RAPID_HOST,
    },
  });

  if (!racecardsRes.ok) {
    const text = await racecardsRes.text();
    console.log("RAPIDAPI_ERROR:", racecardsRes.status, text.slice(0, 500));
    return res.status(racecardsRes.status).json({ error: `RapidAPI error ${racecardsRes.status}: ${text}` });
  }

  const raw = await racecardsRes.json();

  // Log structure so we can see exactly what comes back
  console.log("RAPIDAPI_TYPE:", typeof raw, Array.isArray(raw) ? "array" : "object");
  console.log("RAPIDAPI_KEYS:", JSON.stringify(Array.isArray(raw) ? Object.keys(raw[0] ?? {}) : Object.keys(raw)));
  console.log("RAPIDAPI_SAMPLE:", JSON.stringify(raw).slice(0, 2000));

  res.json({ raw });
}
