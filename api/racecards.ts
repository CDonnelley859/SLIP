import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  const runners = runnerRes.ok ? await runnerRes.json() : {};

  res.json({ courses, runners });
}
