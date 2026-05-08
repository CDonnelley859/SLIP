import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = new Date().toISOString().slice(0, 10);

  const runnerRes = await fetch(`${BASE}/api/runner-info/${date}`, {
    headers: { "X-API-Key": API_KEY },
  });

  const raw = runnerRes.ok ? await runnerRes.json() : { error: runnerRes.status };
  const keys = Object.keys(raw);

  res.json({
    status: runnerRes.status,
    totalKeys: keys.length,
    first3Keys: keys.slice(0, 3),
    firstEntry: raw[keys[0]],
    secondEntry: raw[keys[1]],
  });
}
