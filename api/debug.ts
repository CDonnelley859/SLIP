import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = new Date().toISOString().slice(0, 10);

  const [courseRes, runnerRes] = await Promise.all([
    fetch(`${BASE}/api/course-info/${date}`, { headers: { "X-API-Key": API_KEY } }),
    fetch(`${BASE}/api/runner-info/${date}`, { headers: { "X-API-Key": API_KEY } }),
  ]);

  const courses = await courseRes.json();
  const runners = await runnerRes.json();

  // Show first track from course-info and its race_time values
  const firstTrack = Object.keys(courses)[0];
  const firstTrackRaces = courses[firstTrack] ?? [];

  // Show first 3 runner keys
  const runnerKeys = Object.keys(runners).slice(0, 3);

  res.json({
    courseFirstTrack: firstTrack,
    courseRaceTimes: firstTrackRaces.map((r: any) => r.race_time),
    courseFirstRace: firstTrackRaces[0],
    runnerFirst3Keys: runnerKeys,
  });
}
