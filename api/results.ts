import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { raceId } = req.query;
  const apiKey = process.env.VITE_RACING_API_KEY;

  const upstream = await fetch(
    `https://api.theracingapi.com/v1/results/${raceId}`,
    { headers: { "x-api-key": apiKey! } }
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
