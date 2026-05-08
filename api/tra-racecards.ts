import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Fetch up to 100 racecards — default limit is 50, bump to cover all UK/IRE races
  const upstream = await fetch(`${TRA_BASE}/racecards/free?limit=100`, {
    headers: { Authorization: TRA_AUTH },
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({ error: text });
  }

  const data = await upstream.json();
  res.json(data);
}
