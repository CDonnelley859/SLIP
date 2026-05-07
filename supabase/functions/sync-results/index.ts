import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "@supabase/supabase-js/cors";

// Pull results for a card and score all picks. Body: { card_id }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const u = Deno.env.get("RACING_API_USERNAME");
    const p = Deno.env.get("RACING_API_PASSWORD");
    if (!u || !p) throw new Error("Racing API credentials not configured");

    const { card_id } = await req.json();
    if (!card_id) throw new Error("card_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: card, error: cErr } = await supabase
      .from("cards")
      .select("*")
      .eq("id", card_id)
      .single();
    if (cErr) throw cErr;

    const auth = "Basic " + btoa(`${u}:${p}`);
    const url = `https://api.theracingapi.com/v1/results?date=${card.race_date}`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Racing API ${res.status}`);
    const data = await res.json();
    const trackResults: any[] = (data.results ?? []).filter(
      (r: any) => r.course === card.track_name
    );

    // Map race_number -> winners by joining to our races by sorted off_time
    const { data: races } = await supabase
      .from("races")
      .select("*, horses(id, number, name)")
      .eq("card_id", card_id)
      .order("race_number");
    if (!races) throw new Error("no races");

    trackResults.sort((a, b) => (a.off ?? "").localeCompare(b.off ?? ""));

    let updated = 0;
    for (let i = 0; i < Math.min(races.length, trackResults.length); i++) {
      const race = races[i];
      const result = trackResults[i];
      const runners = result.runners ?? [];
      const winners: Record<string, string | null> = { "1": null, "2": null, "3": null };
      for (const rn of runners) {
        const pos = String(rn.position ?? "");
        if (["1", "2", "3"].includes(pos)) {
          // Match horse by name
          const horse = race.horses.find(
            (h: any) => h.name?.toLowerCase() === rn.horse?.toLowerCase()
          );
          if (horse) winners[pos] = horse.id;
        }
      }

      await supabase
        .from("races")
        .update({ winners, status: "settled" })
        .eq("id", race.id);

      // Score picks for this race
      const { data: picks } = await supabase
        .from("picks")
        .select("id, horse_id")
        .eq("race_id", race.id);
      for (const pick of picks ?? []) {
        let pts = 0;
        if (pick.horse_id === winners["1"]) pts = 5;
        else if (pick.horse_id === winners["2"]) pts = 3;
        else if (pick.horse_id === winners["3"]) pts = 1;
        await supabase.from("picks").update({ points: pts }).eq("id", pick.id);
      }
      updated++;
    }

    // If all races settled, finalize card and write scrum_results
    const allSettled = races.every((r: any) => r.status === "settled") || updated === races.length;
    if (allSettled) {
      await supabase.from("cards").update({ status: "settled" }).eq("id", card_id);

      // Aggregate per scrum
      const { data: scrums } = await supabase
        .from("scrums")
        .select("id")
        .eq("card_id", card_id);
      for (const s of scrums ?? []) {
        const { data: picks } = await supabase
          .from("picks")
          .select("user_id, points")
          .eq("scrum_id", s.id);
        const tally = new Map<string, { total: number; w: number; p: number; sh: number }>();
        for (const pk of picks ?? []) {
          const t = tally.get(pk.user_id) ?? { total: 0, w: 0, p: 0, sh: 0 };
          t.total += pk.points ?? 0;
          if (pk.points === 5) t.w++;
          else if (pk.points === 3) t.p++;
          else if (pk.points === 1) t.sh++;
          tally.set(pk.user_id, t);
        }
        const ranked = [...tally.entries()].sort((a, b) =>
          b[1].total - a[1].total || b[1].w - a[1].w
        );
        for (let i = 0; i < ranked.length; i++) {
          const [uid, t] = ranked[i];
          await supabase.from("scrum_results").upsert(
            {
              scrum_id: s.id,
              user_id: uid,
              total_points: t.total,
              wins: t.w,
              place: t.p,
              show: t.sh,
              rank: i + 1,
              finalized_at: new Date().toISOString(),
            },
            { onConflict: "scrum_id,user_id" }
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
