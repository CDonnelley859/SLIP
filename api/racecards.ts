import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

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

  // OurHub runner-info keys are "TrackName HH:MM" format.
  // Transform into { TrackName: [ { race_time: "HH:MM", ...runnerFields }, ... ] }
  const runners: Record<string, any[]> = {};
  for (const [key, entries] of Object.entries(rawRunners)) {
    const timeMatch = key.match(/(\d{1,2}:\d{2})$/);
    if (!timeMatch) continue;
    const raceTime = timeMatch[1];
    const trackName = key.slice(0, key.length - raceTime.length).trim();
    if (!runners[trackName]) runners[trackName] = [];
    const list = Array.isArray(entries) ? entries : [];
    runners[trackName].push(...list.map(r => ({ ...r, race_time: raceTime })));
  }

  // Debug: log first track and a sample runner
  const firstKey = Object.keys(runners)[0];
  console.log("TRANSFORMED_KEYS:", JSON.stringify(Object.keys(runners)));
  console.log("FIRST_TRACK_SAMPLE:", JSON.stringify((runners[firstKey] ?? []).slice(0, 2)));

  res.json({ courses, runners });
}
