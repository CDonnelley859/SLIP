import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  // Try several possible endpoint names
  const endpoints = [
    `/api/result-info/${date}`,
    `/api/results/${date}`,
    `/api/results?date=${date}`,
    `/api/result/${date}`,
  ];

  const results: Record<string, any> = {};

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(`${BASE}${endpoint}`, {
        headers: { "X-API-Key": API_KEY },
      });
      const text = await r.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text; }
      results[endpoint] = { status: r.status, sample: JSON.stringify(body).slice(0, 500) };
    } catch (e: any) {
      results[endpoint] = { error: e.message };
    }
  }

  res.json(results);
}
