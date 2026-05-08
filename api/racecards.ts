import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  // 1. Get all racecards for the day
  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, { headers: HEADERS });
  if (!racecardsRes.ok) {
    const text = await racecardsRes.text();
    return res.status(racecardsRes.status).json({ error: `RapidAPI error ${racecardsRes.status}: ${text}` });
  }

  const rawRaces: any[] = await racecardsRes.json();

  // 2. Fetch full race detail (includes horses) for all races in parallel
  const detailedRaces: any[] = await Promise.all(
    rawRaces.map(async (race: any) => {
      try {
        const r = await fetch(`${BASE}/race/${race.id_race}`, { headers: HEADERS });
        return r.ok ? await r.json() : race;
      } catch {
        return race;
      }
    })
  );

  // 3. Group by course
  const courses: Record<string, any[]> = {};
  for (const race of detailedRaces) {
    const course = race.course ?? "Unknown";
    if (!courses[course]) courses[course] = [];
    courses[course].push(race);
  }

  res.json({ courses });
}
