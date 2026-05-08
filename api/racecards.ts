import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, { headers: HEADERS });
  if (!racecardsRes.ok) {
    const text = await racecardsRes.text();
    return res.status(racecardsRes.status).json({ error: `RapidAPI error ${racecardsRes.status}: ${text}` });
  }

  const rawRaces: any[] = await racecardsRes.json();

  // Group by course — no runner detail fetching here, keep it fast
  const courses: Record<string, any[]> = {};
  for (const race of rawRaces) {
    const course = race.course ?? "Unknown";
    if (!courses[course]) courses[course] = [];
    courses[course].push(race);
  }

  res.json({ courses });
}
