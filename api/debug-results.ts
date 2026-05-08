import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // Fetch /racecards/free and show full first race object (minus runners array)
  // to see if there are any result/status fields at race level
  const out: Record<string, any> = {};

  try {
    const r = await fetch(`${TRA_BASE}/racecards/free`, {
      headers: { Authorization: TRA_AUTH },
    });
    const text = await r.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }

    const firstRace = Array.isArray(body?.racecards) ? body.racecards[0] : null;
    const firstRunner = firstRace?.runners?.[0];

    // Show full race object without the runners array (too big)
    const raceWithoutRunners = firstRace
      ? Object.fromEntries(Object.entries(firstRace).filter(([k]) => k !== "runners"))
      : null;

    out["raceCount"] = body?.racecards?.length;
    out["raceKeys"] = firstRace ? Object.keys(firstRace) : null;
    out["firstRace_noRunners"] = raceWithoutRunners;
    out["runnerKeys"] = firstRunner ? Object.keys(firstRunner) : null;
    out["firstRunner"] = firstRunner;
  } catch (e: any) {
    out["error"] = (e as any).message;
  }

  res.json(out);
}
