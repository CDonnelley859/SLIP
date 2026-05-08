import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialise Firebase Admin (server-side, for cron)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

const TRA_USER = "08xHXpaIUHJ1IXZq1A4ds8A3";
const TRA_PASS = "a2oT5R6AHlzP10XAhhEDAQhw";
const TRA_BASE = "https://api.theracingapi.com/v1";
const TRA_AUTH = "Basic " + Buffer.from(`${TRA_USER}:${TRA_PASS}`).toString("base64");

function normaliseCourse(course: string): string {
  return course.replace(/\s*\([^)]+\)\s*$/, "").trim().toLowerCase();
}

function displayName(course: string): string {
  return normaliseCourse(course)
    .split(" ")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron jobs send a special auth header — reject anything else in production
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const isCronSecret = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isCronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch TRA racecards
  const upstream = await fetch(`${TRA_BASE}/racecards/free?limit=100`, {
    headers: { Authorization: TRA_AUTH },
  });
  if (!upstream.ok) {
    return res.status(502).json({ error: `TRA error ${upstream.status}` });
  }
  const data = await upstream.json();
  const racecards: any[] = data?.racecards ?? [];

  // Group by normalised course
  const byCourse: Record<string, any[]> = {};
  for (const rc of racecards) {
    const norm = normaliseCourse(rc.course ?? "");
    if (!norm) continue;
    if (!byCourse[norm]) byCourse[norm] = [];
    byCourse[norm].push(rc);
  }

  let raceCount = 0;
  let horseCount = 0;

  for (const [normCourse, courseRacecards] of Object.entries(byCourse)) {
    if (courseRacecards.length === 0) continue;
    courseRacecards.sort((a: any, b: any) =>
      new Date(a.off_dt).getTime() - new Date(b.off_dt).getTime()
    );

    const trackName = displayName(courseRacecards[0].course);
    const courseSlug = normCourse.replace(/\s+/g, "-");
    const cardId = `${today}-${courseSlug}`;
    const cardRef = db.collection("cards").doc(cardId);

    await cardRef.set({
      trackName,
      raceDate: today,
      postTime: courseRacecards[0].off_dt,
      status: "upcoming",
      sourceId: cardId,
      raceCount: courseRacecards.length,
    }, { merge: true });

    for (let i = 0; i < courseRacecards.length; i++) {
      const rc = courseRacecards[i];
      const raceNum = i + 1;
      const raceId = `${cardId}-r${raceNum}`;

      await db.collection("races").doc(raceId).set({
        cardId,
        raceNumber: raceNum,
        name: rc.race_name ?? null,
        offTime: rc.off_dt,
        status: "upcoming",
        winners: null,
        sourceId: raceId,
      }, { merge: true });

      const runners: any[] = rc.runners ?? [];
      if (runners.length > 0) {
        const batch = db.batch();
        runners.forEach((runner: any, idx: number) => {
          const horseRef = db.collection("horses").doc(`${raceId}-h${idx + 1}`);
          batch.set(horseRef, {
            raceId,
            number: Number(runner.number) || idx + 1,
            name: runner.horse ?? "Unknown",
            jockey: runner.jockey ?? null,
            odds: null,
          }, { merge: true });
          horseCount++;
        });
        await batch.commit();
      }

      raceCount++;
    }
  }

  res.json({ ok: true, raceCount, horseCount, date: today });
}
