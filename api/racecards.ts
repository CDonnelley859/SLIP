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
  const rawRunners = runnerRes.ok ? await runnerRes.json() : {};

  // Log the exact runner structure so we can see the format
  const keys = Object.keys(rawRunners);
  console.log("RUNNER_KEY_COUNT:", keys.length);
  console.log("RUNNER_KEY_0:", JSON.stringify(keys[0]));
  console.log("RUNNER_KEY_1:", JSON.stringify(keys[1]));
  console.log("RUNNER_ENTRY_0:", JSON.stringify((rawRunners[keys[0]] ?? []).slice(0, 1)));

  res.json({ courses, runners: rawRunners });
}
