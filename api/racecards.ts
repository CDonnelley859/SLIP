import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

async function fetchRaceDetail(id_race: string, fallback: any): Promise<any> {
  try {
    const r = await fetch(`${BASE}/race/${id_race}`, { headers: HEADERS });
    if (r.ok) return await r.json();
    console.log(`Race ${id_race} returned ${r.status}`);
    return fallback;
  } catch {
    return fallback;
  }
}

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

  // 2. Fetch race detail in batches of 5 to avoid rate limiting
  const BATCH_SIZE = 5;
  const detailedRaces: any[] = [];

  for (let i = 0; i < rawRaces.length; i += BATCH_SIZE) {
    const batch = rawRaces.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((race: any) => fetchRaceDetail(race.id_race, race))
    );
    detailedRaces.push(...results);
    // Brief pause between batches to stay within rate limits
    if (i + BATCH_SIZE < rawRaces.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 3. Group by course
  const courses: Record<string, any[]> = {};
  for (const race of detailedRaces) {
    const course = race.course ?? "Unknown";
    if (!courses[course]) courses[course] = [];
    courses[course].push(race);
  }

  console.log(`Synced ${detailedRaces.length} races, ${detailedRaces.filter(r => r.horses?.length > 0).length} with horses`);

  res.json({ courses });
}
