import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { date, region = "gb" } = req.query;
  const apiKey = process.env.RACING_API_KEY ?? process.env.VITE_RACING_API_KEY ?? "PPTyhCg2F28P1tT2BGbqOqN0KbtLuYy3TJgZzx0IwtercZCs";

  const upstream = await fetch(
    `https://api.theracingapi.com/v1/racecards/free?date=${date}&region=${region}`,
    { headers: { "x-api-key": apiKey! } }
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
