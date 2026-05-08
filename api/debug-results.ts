import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const endpoints = [
    `/results`,
    `/results?day=today`,
    `/results?region=gb`,
    `/results?region=gb&date=${date}`,
    `/racecards/results`,
    `/racecards/results/today`,
    `/results/free`,
    `/results?limit=10`,
  ];

  const out: Record<string, any> = {};

  for (const path of endpoints) {
    try {
      const r = await fetch(`${TRA_BASE}${path}`, {
        headers: { Authorization: TRA_AUTH },
      });
      const text = await r.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text; }
      out[path] = { status: r.status, sample: JSON.stringify(body).slice(0, 600) };
    } catch (e: any) {
      out[path] = { error: e.message };
    }
  }

  res.json(out);
}
