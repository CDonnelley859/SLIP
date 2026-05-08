import type { VercelRequest, VercelResponse } from "@vercel/node";

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const endpoints = [
    `/racecards/free`,
    `/racecards/free?region=gb`,
    `/racecards/free?region=gb&limit=1`,
    `/racecards/free?course=Ascot`,
  ];

  const out: Record<string, any> = {};

  for (const path of endpoints) {
    try {
      const r = await fetch(`${TRA_BASE}${path}`, {
        headers: { Authorization: TRA_AUTH },
      });
      const text = await r.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text; }
      // Show top-level keys and first race sample
      const keys = typeof body === "object" ? Object.keys(body) : [];
      const firstRace = Array.isArray(body?.racecards) ? body.racecards[0] : null;
      const firstRunner = firstRace?.runners?.[0];
      out[path] = {
        status: r.status,
        topKeys: keys,
        raceCount: body?.racecards?.length,
        firstRaceCourse: firstRace?.course,
        firstRaceOff: firstRace?.off,
        firstRaceStatus: firstRace?.status,
        firstRunnerKeys: firstRunner ? Object.keys(firstRunner) : null,
        firstRunnerSample: firstRunner,
      };
    } catch (e: any) {
      out[path] = { error: e.message };
    }
  }

  res.json(out);
}
