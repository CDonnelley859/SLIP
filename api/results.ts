import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // /results/today is available on Basic plan and above
  const upstream = await fetch(`${TRA_BASE}/results/today`, {
    headers: { Authorization: TRA_AUTH },
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({
      error: `Racing API error ${upstream.status}: ${text}`,
    });
  }

  const data = await upstream.json();
  res.json(data);
}
