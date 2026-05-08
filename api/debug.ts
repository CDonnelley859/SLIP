import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAPID_KEY = "d64a3b4038mshc5b238284ed0135p132fefjsn86b9763cc3cf";
const RAPID_HOST = "horse-racing.p.rapidapi.com";
const BASE = `https://${RAPID_HOST}`;
const HEADERS = { "x-rapidapi-key": RAPID_KEY, "x-rapidapi-host": RAPID_HOST };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const detailRes = await fetch(`${BASE}/race/269481`, { headers: HEADERS });
  const detail = await detailRes.json();

  const runners: any[] = detail.runners ?? detail.horses ?? detail.entries ?? [];

  res.json({
    topLevelKeys: Object.keys(detail),
    runnerCount: runners.length,
    firstRunner: runners[0] ?? null,
    firstRunnerKeys: runners[0] ? Object.keys(runners[0]) : [],
  });
}
