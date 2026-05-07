import { supabase } from "@/integrations/supabase/client";

const API_KEY = import.meta.env.VITE_RACING_API_KEY;
const BASE = "https://api.theracingapi.com/v1";

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`Racing API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function syncCards(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/racecards/pro?date=${today}&region=gb`);
  const racecards = data.racecards ?? [];
  let count = 0;

  for (const card of racecards) {
    const courseId = card.course_id ?? card.course.replace(/\s+/g, "-").toLowerCase();
    const cardId = `${today}-${courseId}`;

    await supabase.from("cards").upsert({
      id: cardId,
      track_name: card.course,
      race_date: today,
      post_time: card.races?.[0]?.off_time ?? `${today}T12:00:00Z`,
      status: "upcoming",
      source_id: cardId,
    });

    for (const race of card.races ?? []) {
      await supabase.from("races").upsert({
        id: race.race_id,
        card_id: cardId,
        race_number: race.race_num ?? race.race_number,
        name: race.race_name ?? null,
        off_time: race.off_time,
        status: "upcoming",
        winners: null,
      });

      for (const runner of race.runners ?? []) {
        await supabase.from("horses").upsert({
          id: runner.horse_id ?? String(runner.number),
          race_id: race.race_id,
          number: runner.number,
          name: runner.horse,
          jockey: runner.jockey ?? null,
          odds: runner.sp_dec ? `${runner.sp_dec}` : (runner.odds ?? null),
        });
      }

      count++;
    }
  }

  return count;
}

export async function syncResults(cardId: string): Promise<void> {
  const { data: races } = await supabase
    .from("races")
    .select("id, status")
    .eq("card_id", cardId);

  for (const race of races ?? []) {
    if (race.status === "settled") continue;

    try {
      const data = await apiFetch(`/results/${race.id}`);
      const result = data.result ?? data;
      const runners: any[] = result.runners ?? [];

      const getAt = (pos: number) => runners.find((r: any) => Number(r.position) === pos);
      const first = getAt(1);
      const second = getAt(2);
      const third = getAt(3);

      if (!first) continue;

      await supabase.from("races").update({
        status: "settled",
        winners: {
          first: first.horse_id ?? null,
          second: second?.horse_id ?? null,
          third: third?.horse_id ?? null,
        },
      }).eq("id", race.id);

      const { data: picks } = await supabase
        .from("picks")
        .select("id, horse_id")
        .eq("race_id", race.id);

      for (const pick of picks ?? []) {
        let points = 0;
        if (pick.horse_id === first.horse_id) points = 5;
        else if (pick.horse_id === second?.horse_id) points = 3;
        else if (pick.horse_id === third?.horse_id) points = 1;
        await supabase.from("picks").update({ points }).eq("id", pick.id);
      }
    } catch {
      // result not yet available — skip silently
    }
  }
}
