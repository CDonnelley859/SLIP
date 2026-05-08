import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = new Date().toISOString().slice(0, 10);

  const racecardsRes = await fetch(`${BASE}/racecards?date=${date}`, {
    headers: {
      "x-rapidapi-key": RAPID_KEY,
      "x-rapidapi-host": RAPID_HOST,
    },
  });

  const raw = await racecardsRes.json();
  const races: any[] = Array.isArray(raw) ? raw : (raw.races ?? raw.data ?? []);
  const first = races[0] ?? {};

  res.json({
    status: racecardsRes.status,
    totalRaces: races.length,
    firstRaceKeys: Object.keys(first),
    firstRace: first,
  });
}
