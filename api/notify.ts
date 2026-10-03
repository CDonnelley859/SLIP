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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { scrumId, raceId } = req.body ?? {};
  if (typeof scrumId !== "string" || typeof raceId !== "string" || !scrumId || !raceId) {
    return res.status(400).json({ error: "Missing scrumId or raceId" });
  }

  const db = getFirestore();

  // Never trust winners from the request body: this endpoint is public, so read
  // the settled result from the race doc and only ever announce what is true.
  const raceDoc = await db.collection("races").doc(raceId).get();
  const winners = raceDoc.data()?.winners;
  if (!raceDoc.exists || raceDoc.data()?.status !== "settled" || !winners?.first) {
    return res.status(409).json({ error: "Race is not settled" });
  }

  // Notify each scrum/race pair at most once, so repeat calls can't spam members.
  const sentRef = db.collection("notifySent").doc(`${scrumId}_${raceId}`);
  try {
    await sentRef.create({ at: Date.now() });
  } catch {
    return res.json({ ok: true, sent: 0, failed: 0, alreadySent: true });
  }

  // Fetch all picks for this scrum + race
  const picksSnap = await db.collection("picks")
    .where("scrumId", "==", scrumId)
    .where("raceId", "==", raceId)
    .get();

  if (picksSnap.empty) return res.json({ ok: true, sent: 0, failed: 0 });

  const raceNumber = raceDoc.data()?.raceNumber ?? "?";

  let sent = 0;
  let failed = 0;

  for (const pickDoc of picksSnap.docs) {
    const { userId, horseId } = pickDoc.data();

    // Determine result for this pick
    let result = "OUT";
    if (horseId === winners.first) result = "WIN";
    else if (horseId === winners.second) result = "PLACE";
    else if (horseId === winners.third) result = "SHOW";

    // Get push subscription
    const subDoc = await db.collection("pushSubscriptions").doc(userId).get();
    if (!subDoc.exists) continue;
    const sub = subDoc.data()?.subscription;
    if (!sub) continue;

    // Get horse name
    const horseDoc = await db.collection("horses").doc(horseId).get();
    const horseName = horseDoc.exists ? (horseDoc.data()?.name ?? "Your horse") : "Your horse";

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
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: titles[result],
          body: bodies[result],
          url: `/scrum/${scrumId}/slip`,
        })
      );
      sent++;
    } catch {
      // Subscription may be expired — clean it up silently
      failed++;
    }
  }

  res.json({ ok: true, sent, failed });
}
