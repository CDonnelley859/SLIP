// Shared Racing API config. Files prefixed with "_" are not deployed as Vercel functions.
export const TRA_BASE = "https://api.theracingapi.com/v1";

export function traAuth(): string {
  const user = process.env.TRA_USER;
  const pass = process.env.TRA_PASS;
  if (!user || !pass) throw new Error("TRA_USER and TRA_PASS env vars are not set");
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}
