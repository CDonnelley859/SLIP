import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstream = await fetch(`${TRA_BASE}/racecards/free?limit=100`, {
    headers: { Authorization: TRA_AUTH },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: await upstream.text() });
  }

  const data = await upstream.json();
  const racecards: any[] = data?.racecards ?? [];

  // Group by course name and count races per course
  const courses: Record<string, { count: number; firstRace: string }> = {};
  for (const rc of racecards) {
    const course = rc.course ?? "Unknown";
    if (!courses[course]) {
      courses[course] = { count: 0, firstRace: rc.off_dt ?? "—" };
    }
    courses[course].count++;
  }

  const sorted = Object.entries(courses)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([course, info]) => ({ course, races: info.count, firstRace: info.firstRace }));

  res.json({ total: racecards.length, courses: sorted });
}
