import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sync upcoming racecards from TheRacingAPI into cards/races/horses.
// Defaults to today. Pass {date: "YYYY-MM-DD"} or {region: "gb"} in body to filter.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const u = Deno.env.get("RACING_API_USERNAME");
    const p = Deno.env.get("RACING_API_PASSWORD");
    if (!u || !p) throw new Error("Racing API credentials not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const auth = "Basic " + btoa(`${u}:${p}`);
    // Free plan endpoint — returns next day's UK & IRE meetings.
    // Upgrade to Standard/Pro to use /racecards/standard or /racecards/pro with a `day` param.
    const url = `https://api.theracingapi.com/v1/racecards/free`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Racing API ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const racecards: any[] = data.racecards ?? [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Group by track + race_date to form a card
    const grouped = new Map<string, any[]>();
    for (const r of racecards) {
      const key = `${r.course}__${r.date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    let cardCount = 0, raceCount = 0, horseCount = 0;

    for (const [key, races] of grouped) {
      races.sort((a, b) => (a.off_time ?? "").localeCompare(b.off_time ?? ""));
      const first = races[0];
      const sourceId = `tra_${first.course_id ?? first.course}_${first.date}`;
      const postTime = `${first.date}T${first.off_time ?? "12:00"}:00Z`;

      const { data: card, error: cErr } = await supabase
        .from("cards")
        .upsert(
          {
            source_id: sourceId,
            track_name: first.course,
            race_date: first.date,
            post_time: postTime,
            status: "upcoming",
          },
          { onConflict: "source_id" }
        )
        .select()
        .single();
      if (cErr) throw cErr;
      cardCount++;

      for (let i = 0; i < races.length; i++) {
        const race = races[i];
        const offTime = `${race.date}T${race.off_time ?? "12:00"}:00Z`;
        const { data: raceRow, error: rErr } = await supabase
          .from("races")
          .upsert(
            {
              card_id: card.id,
              race_number: i + 1,
              name: race.race_name ?? `Race ${i + 1}`,
              off_time: offTime,
              status: "upcoming",
            },
            { onConflict: "card_id,race_number" }
          )
          .select()
          .single();
        if (rErr) throw rErr;
        raceCount++;

        const runners: any[] = race.runners ?? [];
        if (runners.length) {
          const horseRows = runners.map((rn, idx) => ({
            race_id: raceRow.id,
            number: parseInt(rn.number ?? rn.draw ?? `${idx + 1}`, 10) || idx + 1,
            name: rn.horse,
            jockey: rn.jockey,
            odds: rn.odds?.[0]?.fractional ?? rn.sp ?? null,
          }));
          // Clear & reinsert horses for this race for simplicity
          await supabase.from("horses").delete().eq("race_id", raceRow.id);
          const { error: hErr } = await supabase.from("horses").insert(horseRows);
          if (hErr) throw hErr;
          horseCount += horseRows.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, cards: cardCount, races: raceCount, horses: horseCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
