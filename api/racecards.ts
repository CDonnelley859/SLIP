import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

// OurHub runner keys use 12-hour time (e.g. "01:50" = 1:50 PM = "13:50")
// Convert to 24-hour so it matches course-info race_time
function to24h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const h24 = h < 12 ? h + 12 : h;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const [courseRes, runnerRes] = await Promise.all([
    fetch(`${BASE}/api/course-info/${date}`, { headers: { "X-API-Key": API_KEY } }),
    fetch(`${BASE}/api/runner-info/${date}`, { headers: { "X-API-Key": API_KEY } }),
  ]);

  if (!courseRes.ok) {
    const text = await courseRes.text();
    return res.status(courseRes.status).json({ error: `OurHub error ${courseRes.status}: ${text}` });
  }

  const courses = await courseRes.json();
  const rawRunners: Record<string, any[]> = runnerRes.ok ? await runnerRes.json() : {};

  // Transform runner keys "Ascot 01:50 Race Name" → nested by track + 24h time
  // Result: { "Ascot": { "13:50": [...runners] } }
  const runners: Record<string, Record<string, any[]>> = {};

  for (const [key, entries] of Object.entries(rawRunners)) {
    const timeMatch = key.match(/\b(\d{2}:\d{2})\b/);
    if (!timeMatch) continue;

    const raceTime = timeMatch[1]; // "01:50" — same format as course-info race_time
    const trackName = key.slice(0, key.indexOf(raceTime)).trim();

    if (!runners[trackName]) runners[trackName] = {};
    if (!runners[trackName][raceTime]) runners[trackName][raceTime] = [];

    if (Array.isArray(entries)) runners[trackName][raceTime].push(...entries);
  }

  // Log a sample to verify matching
  const firstTrack = Object.keys(courses)[0];
  const firstRace = courses[firstTrack]?.[0];
  const firstRaceTime = firstRace?.race_time;
  const firstRunners = firstTrack && firstRaceTime ? runners[firstTrack]?.[firstRaceTime] : null;
  console.log("MATCH_CHECK:", JSON.stringify({ firstTrack, firstRaceTime, runnerCount: firstRunners?.length ?? 0 }));

  res.json({ courses, runners });
}
