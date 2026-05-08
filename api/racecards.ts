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
    console.log("RAPIDAPI_ERROR:", racecardsRes.status, text.slice(0, 300));
    return res.status(racecardsRes.status).json({ error: `RapidAPI error ${racecardsRes.status}: ${text}` });
  }

  const raw = await racecardsRes.json();
  const races: any[] = Array.isArray(raw) ? raw : (raw.races ?? raw.data ?? []);

  // Single log with everything we need to understand the shape
  const sample = races[0] ?? {};
  console.log("SAMPLE_RACE:", JSON.stringify({
    keys: Object.keys(sample),
    time: sample.time ?? sample.race_time ?? sample.off ?? sample.off_time,
    course: sample.course ?? sample.venue ?? sample.track,
    title: sample.title ?? sample.race_name ?? sample.name,
    runnerCount: (sample.runners ?? sample.horses ?? []).length,
    firstRunner: (sample.runners ?? sample.horses ?? [])[0] ?? null,
  }));

  // Group races by course for racingApi.ts to consume
  const courses: Record<string, any[]> = {};
  for (const race of races) {
    const course = race.course ?? race.venue ?? race.track ?? "Unknown";
    if (!courses[course]) courses[course] = [];
    courses[course].push(race);
  }

  res.json({ courses, races });
}
