import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Fetch first 5 races and check if detail calls return horses
  const date = new Date().toISOString().slice(0, 10);
  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, { headers: HEADERS });
  const rawRaces: any[] = await racecardsRes.json();
  const first5 = rawRaces.slice(0, 5);

  const results = await Promise.all(
    first5.map(async (race: any) => {
      const r = await fetch(`${BASE}/race/${race.id_race}`, { headers: HEADERS });
      const detail = await r.json();
      return {
        id_race: race.id_race,
        course: race.course,
        status: r.status,
        hasHorses: Array.isArray(detail.horses),
        horseCount: detail.horses?.length ?? 0,
        error: r.status !== 200 ? detail : undefined,
      };
    })
  );

  res.json(results);
}
