import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Expects ?ids=269481,269482,269483
  const ids = ((req.query.ids as string) ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return res.json({});

  // Fetch all race details in parallel — only a handful per venue
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fetch(`${BASE}/race/${id}`, { headers: HEADERS });
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    })
  );

  // Return as { id_race: raceDetail }
  const byId: Record<string, any> = {};
  for (const detail of results) {
    if (detail?.id_race) byId[detail.id_race] = detail;
  }

  res.json(byId);
}
