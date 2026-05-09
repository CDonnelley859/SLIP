import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstream = await fetch(`${TRA_BASE}/results/today/free`, {
    headers: { Authorization: TRA_AUTH },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: await upstream.text() });
  }

  const data = await upstream.json();
  const results: any[] = data?.results ?? [];

  // Return a stripped-down view: course, off_dt, off, and first 3 runners per race
  const summary = results.map((r: any) => ({
    course: r.course,
    off_dt: r.off_dt,
    off: r.off,
    race_name: r.race_name,
    // Show all top-level keys so we can see what fields exist
    keys: Object.keys(r),
    // First 3 runners with their position field
    runners: (r.runners ?? []).slice(0, 3).map((h: any) => ({
      position: h.position,
      horse: h.horse,
      positionKeys: Object.keys(h),
    })),
  }));

  res.json({ total: results.length, summary });
}
