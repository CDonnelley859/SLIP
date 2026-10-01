import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TRA_BASE, traAuth } from "./_tra";


export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Fetch up to 100 racecards — default limit is 50, bump to cover all UK/IRE races
  const upstream = await fetch(`${TRA_BASE}/racecards/free?limit=100`, {
    headers: { Authorization: traAuth() },
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({ error: text });
  }

  const data = await upstream.json();
  res.json(data);
}
