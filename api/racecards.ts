import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { date, region = "gb" } = req.query;
  const apiKey = process.env.VITE_RACING_API_KEY;

  const upstream = await fetch(
    `https://api.theracingapi.com/v1/racecards/pro?date=${date}&region=${region}`,
    { headers: { "x-api-key": apiKey! } }
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
