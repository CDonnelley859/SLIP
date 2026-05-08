import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Fetch first race from today's racecards
  const date = new Date().toISOString().slice(0, 10);
  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, { headers: HEADERS });
  const raw = await racecardsRes.json();
  const races: any[] = Array.isArray(raw) ? raw : [];
  const firstRace = races[0];

  if (!firstRace) return res.json({ error: "No races today" });

  // Try to fetch race detail for first race
  const detailRes = await fetch(`${BASE}/races/${firstRace.id_race}`, { headers: HEADERS });
  const detail = await detailRes.json();

  res.json({
    detailStatus: detailRes.status,
    detailKeys: Object.keys(Array.isArray(detail) ? (detail[0] ?? {}) : detail),
    detail: Array.isArray(detail) ? detail.slice(0, 2) : detail,
  });
}
