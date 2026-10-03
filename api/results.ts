import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TRA_BASE, traAuth } from "./_tra";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // /results/today/free is available on the free plan
  const upstream = await fetch(`${TRA_BASE}/results/today/free`, {
    headers: { Authorization: traAuth() },
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
