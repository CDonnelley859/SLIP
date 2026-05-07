import { supabase } from "@/integrations/supabase/client";

async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`Racing API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function syncCards(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFetch(`/racecards?date=${today}`);

  const courses: Record<string, any[]> = data.courses ?? {};
  const runners: Record<string, any> = data.runners ?? {};
  let count = 0;

  for (const [trackName, races] of Object.entries(courses)) {
    if (!Array.isArray(races) || races.length === 0) continue;

    const courseSlug = trackName.replace(/\s+/g, "-").toLowerCase();
    const sourceId = `${today}-${courseSlug}`;
    const firstRaceTime = races[0]?.race_time ?? "12:00";
    const postTime = `${today}T${firstRaceTime}:00Z`;

    const { data: cardRow } = await supabase
      .from("cards")
      .upsert({
        track_name: trackName,
        race_date: today,
        post_time: postTime,
        status: "upcoming",
        source_id: sourceId,
      }, { onConflict: "source_id" })
      .select("id")
      .single();

    if (!cardRow) continue;

    const trackRunners: Record<string, any[]> = runners[trackName] ?? {};

    for (let i = 0; i < races.length; i++) {
      const race = races[i];
      const raceNum = i + 1;
      const raceSourceId = `${sourceId}-r${raceNum}`;
      const offTime = `${today}T${race.race_time ?? "12:00"}:00Z`;

      const { data: raceRow } = await (supabase.from("races") as any)
        .upsert({
          card_id: cardRow.id,
          race_number: raceNum,
          name: race.race_name ?? null,
          off_time: offTime,
          status: "upcoming",
          winners: null,
          source_id: raceSourceId,
        }, { onConflict: "card_id,race_number" })
        .select("id")
        .single();

      if (!raceRow) { count++; continue; }

      const raceRunners: any[] = trackRunners[race.race_time] ?? [];
      for (const runner of raceRunners) {
        await supabase.from("horses").upsert({
          race_id: raceRow.id,
          number: runner.saddle_number ?? runner.number ?? 0,
          name: runner.horse ?? runner.name ?? "Unknown",
          jockey: runner.jockey ?? null,
          odds: runner.odds ?? null,
        }, { onConflict: "race_id,number" });
      }

      count++;
    }
  }

  return count;
}

export async function syncResults(cardId: string): Promise<void> {
  const { data: races } = await (supabase.from("races") as any)
    .select("id, source_id, status")
    .eq("card_id", cardId);

  for (const race of (races ?? []) as any[]) {
    if (race.status === "settled") continue;
    if (!race.source_id) continue;

    try {
      const data = await apiFetch(`/results?raceId=${race.source_id}`);
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

      for (const pick of (picks ?? []) as any[]) {
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
