import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const id = "269481";

  // Try several possible endpoint patterns in parallel
  const attempts = [
    `/race-detail?id_race=${id}`,
    `/race-detail/${id}`,
    `/race/${id}`,
    `/races?id_race=${id}`,
    `/runners?id_race=${id}`,
    `/runners/${id}`,
    `/racecards/${id}`,
  ];

  const results = await Promise.all(
    attempts.map(async (path) => {
      const r = await fetch(`${BASE}${path}`, { headers: HEADERS });
      const body = await r.text();
      return { path, status: r.status, body: body.slice(0, 200) };
    })
  );

  res.json(results);
}
