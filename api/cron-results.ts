import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

webpush.setVapidDetails(
  "mailto:callum@blottogames.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

function normaliseCourse(course: string): string {
  return course.replace(/\s*\([^)]+\)\s*$/, "").trim().toLowerCase();
}
function normaliseName(name: string): string {
  return name.replace(/\s*\([A-Z]+\)\s*$/, "").trim().toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const isCronSecret = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isCronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch TRA results
  const upstream = await fetch(`${TRA_BASE}/results/today/free`, {
    headers: { Authorization: TRA_AUTH },
  });
  if (!upstream.ok) return res.status(502).json({ error: `TRA error ${upstream.status}` });
  const data = await upstream.json();
  const traRaces: any[] = data?.results ?? [];

  // Get all of today's cards
  const cardsSnap = await db.collection("cards").where("raceDate", "==", today).get();

  let settled = 0;
  let notified = 0;

  for (const cardDoc of cardsSnap.docs) {
    const { trackName } = cardDoc.data();
    const normTrack = normaliseCourse(trackName);

    const trackResults = traRaces.filter(
      (r: any) => normaliseCourse(r.course ?? "") === normTrack
    );
    if (trackResults.length === 0) continue;

    // Get all unsettled races for this card
    const racesSnap = await db.collection("races")
      .where("cardId", "==", cardDoc.id)
      .where("status", "!=", "settled")
      .get();

    for (const raceDoc of racesSnap.docs) {
      const race = raceDoc.data();
      if (!race.offTime) continue;

      const raceUTC = new Date(race.offTime).getTime();
      const match = trackResults.find((r: any) => {
        const traTime = new Date(r.off_dt).getTime();
        return Math.abs(traTime - raceUTC) < 5 * 60 * 1000;
      });
      if (!match) continue;

      const runners: any[] = match.runners ?? [];
      const atPos = (pos: string) => runners.find((r: any) => String(r.position) === pos);
      const first = atPos("1");
      const second = atPos("2");
      const third = atPos("3");
      if (!first) continue;

      // Look up horse IDs by name
      const horsesSnap = await db.collection("horses").where("raceId", "==", raceDoc.id).get();
      const nameToId: Record<string, string> = {};
      horsesSnap.docs.forEach(h => {
        nameToId[normaliseName(h.data().name ?? "")] = h.id;
      });
      const toId = (runner: any) =>
        runner ? (nameToId[normaliseName(runner.horse ?? "")] ?? null) : null;

      const winners = {
        first: toId(first),
        second: toId(second),
        third: toId(third),
      };
      if (!winners.first) continue;

      // Settle the race
      await raceDoc.ref.update({ status: "settled", winners });
      settled++;

      // Score picks
      const picksSnap = await db.collection("picks").where("raceId", "==", raceDoc.id).get();
      const batch = db.batch();
      const uniqueScrumIds = new Set<string>();
      for (const pickDoc of picksSnap.docs) {
        const { horseId, scrumId } = pickDoc.data();
        let points = 0;
        if (horseId === winners.first) points = 5;
        else if (horseId === winners.second) points = 3;
        else if (horseId === winners.third) points = 1;
        batch.update(pickDoc.ref, { points });
        if (scrumId) uniqueScrumIds.add(scrumId);
      }
      await batch.commit();

      // Send push notifications per scrum
      for (const scrumId of uniqueScrumIds) {
        const scrumPicksSnap = await db.collection("picks")
          .where("scrumId", "==", scrumId)
          .where("raceId", "==", raceDoc.id)
          .get();

        for (const pickDoc of scrumPicksSnap.docs) {
          const { userId, horseId } = pickDoc.data();

          let result = "OUT";
          if (horseId === winners.first) result = "WIN";
          else if (horseId === winners.second) result = "PLACE";
          else if (horseId === winners.third) result = "SHOW";

          const subDoc = await db.collection("pushSubscriptions").doc(userId).get();
          if (!subDoc.exists) continue;
          const sub = subDoc.data()?.subscription;
          if (!sub) continue;

          const horseDoc = await db.collection("horses").doc(horseId).get();
          const horseName = horseDoc.exists ? (horseDoc.data()?.name ?? "Your horse") : "Your horse";
          const raceNumber = race.raceNumber ?? "?";

          const titles: Record<string, string> = {
            WIN:   `🏆 WIN — Race ${raceNumber}`,
            PLACE: `🥈 PLACE — Race ${raceNumber}`,
            SHOW:  `🥉 SHOW — Race ${raceNumber}`,
            OUT:   `Race ${raceNumber} settled`,
          };
          const bodies: Record<string, string> = {
            WIN:   `${horseName} won — +5 pts!`,
            PLACE: `${horseName} placed 2nd — +3 pts!`,
            SHOW:  `${horseName} placed 3rd — +1 pt!`,
            OUT:   `${horseName} didn't place this time.`,
          };

          try {
            await webpush.sendNotification(sub, JSON.stringify({
              title: titles[result],
              body: bodies[result],
              url: `/scrum/${scrumId}/slip`,
            }));
            notified++;
          } catch { /* expired subscription — ignore */ }
        }
      }
    }
  }

  res.json({ ok: true, settled, notified, date: today });
}
