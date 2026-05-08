import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_KEY = "oh_C2xOzhL0KOZPyGVtDjwq-ySdZYYwMwvQ";
const BASE = "https://api.ourhub.site";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const upstream = await fetch(
    `${BASE}/api/result-info/${date}`,
    { headers: { "X-API-Key": API_KEY } }
  );

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({ error: `OurHub results error ${upstream.status}: ${text}` });
  }

  const data = await upstream.json();
  res.json(data);
}
