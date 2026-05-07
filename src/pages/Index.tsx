import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { syncCards } from "@/lib/racingApi";
import { toast } from "sonner";

type Card = {
  id: string;
  track_name: string;
  race_date: string;
  post_time: string;
  status: string;
  raceCount: number;
};

type ActiveSlip = {
  scrumId: string;
  scrumName: string;
  trackName: string;
  completed: number;
  total: number;
};

const Index = () => {
  const { userId, handle } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [activeSlips, setActiveSlips] = useState<ActiveSlip[]>([]);
  const [trackSearch, setTrackSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: cardsData } = await supabase
      .from("cards")
      .select("id, track_name, race_date, post_time, status, races(id)")
      .in("status", ["upcoming", "live"])
      .order("post_time", { ascending: true })
      .limit(10);

    const cardList: Card[] = (cardsData ?? []).map((c: any) => ({
      id: c.id,
      track_name: c.track_name,
      race_date: c.race_date,
      post_time: c.post_time,
      status: c.status,
      raceCount: Array.isArray(c.races) ? c.races.length : 0,
    }));
    setCards(cardList);

    const { data: memberships } = await supabase
      .from("scrum_members")
      .select("scrum_id, scrums(id, name, card_id, cards(track_name))")
      .eq("user_id", userId);

    const slips: ActiveSlip[] = [];
    for (const m of (memberships ?? []) as any[]) {
      const scrum = m.scrums;
      if (!scrum) continue;
      const { data: races } = await supabase
        .from("races")
        .select("id, status")
        .eq("card_id", scrum.card_id);

      const total = races?.length ?? 0;
      const completed = races?.filter((r: any) => r.status === "settled").length ?? 0;
      if (total > 0 && completed >= total) continue;

      slips.push({
        scrumId: m.scrum_id,
        scrumName: scrum.name,
        trackName: scrum.cards?.track_name ?? "—",
        completed,
        total,
      });
    }
    setActiveSlips(slips);
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      const count = await syncCards();
      toast.success(`${count} races loaded`);
      loadData();
    } catch (err: any) {
      toast.error(err.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data: scrum, error } = await supabase
        .from("scrums")
        .select("id")
        .eq("join_code", joinCode.toUpperCase().trim())
        .single();

      if (error || !scrum) throw new Error("Code not found");

      await supabase.from("scrum_members").upsert({
        scrum_id: scrum.id,
        user_id: userId,
      });

      navigate(`/scrum/${scrum.id}/gallop`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  const filteredCards = cards.filter(c =>
    c.track_name.toLowerCase().includes(trackSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-background border-b-brutalist flex justify-center items-center w-full h-16 px-4 sticky top-0 z-50">
        <h1 className="text-headline-xl font-black tracking-tighter uppercase">SLIP</h1>
      </header>

      <main className="px-4">
        {/* Top Tracks */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-label-caps uppercase">Top Tracks</h2>
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="text-label-caps uppercase underline underline-offset-2 disabled:opacity-40"
            >
              {syncing ? "LOADING…" : "REFRESH"}
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="border-brutalist p-6 text-center">
              <p className="text-body-md text-muted-foreground">
                No cards loaded. Hit Refresh to pull today's racecards.
              </p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-0 -mx-4 px-4 pb-2">
              {filteredCards.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/scrum/new?card=${c.id}`}
                  className={`flex-shrink-0 w-40 border-brutalist p-4 bg-background flex flex-col justify-between h-28 ${i > 0 ? "ml-[-2.67px]" : ""}`}
                >
                  <span className="text-headline-md uppercase leading-tight line-clamp-2">
                    {c.track_name}
                  </span>
                  <span className="text-label-caps text-muted-foreground uppercase">
                    {c.raceCount} RACES
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Search tracks */}
        <section className="mt-6">
          <div className="relative flex border-brutalist h-14">
            <label className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              SEARCH_TRACKS
            </label>
            <input
              value={trackSearch}
              onChange={e => setTrackSearch(e.target.value)}
              placeholder="ENTER TRACK NAME"
              className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
        </section>

        {/* Join by group code */}
        <section className="mt-4">
          <form onSubmit={handleJoin}>
            <div className="relative flex border-brutalist h-14">
              <label className="absolute top-[-9px] left-4 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
                GROUP_CODE
              </label>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="ENTER JOIN CODE"
                maxLength={6}
                className="flex-1 bg-transparent px-4 text-body-md uppercase placeholder:text-muted-foreground/40 focus:outline-none font-mono tracking-widest"
              />
              <button
                type="submit"
                disabled={joining || joinCode.length < 6}
                className="bg-primary text-primary-foreground px-6 text-headline-md uppercase border-l-brutalist disabled:opacity-40 transition-none"
              >
                JOIN
              </button>
            </div>
          </form>
        </section>

        {/* Active Slips */}
        <section className="mt-8">
          <h2 className="text-label-caps uppercase mb-2">Active Slips</h2>
          {activeSlips.length === 0 ? (
            <div className="border-brutalist p-6 text-center">
              <p className="text-body-md text-muted-foreground">
                No active slips. Pick a track above or enter a group code.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {activeSlips.map((s, i) => (
                <Link
                  key={s.scrumId}
                  to={`/scrum/${s.scrumId}/slip`}
                  className={`border-brutalist p-4 flex flex-col gap-3 bg-background ${i > 0 ? "mt-[-2.67px]" : ""}`}
                >
                  <div>
                    <span className="text-label-caps text-muted-foreground uppercase block">VENUE</span>
                    <span className="text-headline-md uppercase">{s.trackName}</span>
                    <div className="mt-1">
                      <span className="text-label-caps text-muted-foreground uppercase block">GROUP</span>
                      <span className="text-body-md font-bold uppercase">{s.scrumName}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-label-caps uppercase">
                      <span>PROGRESS</span>
                      <span>{s.completed}/{s.total || 6}</span>
                    </div>
                    <div className="h-3 w-full border border-primary p-[1px]">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${s.total ? (s.completed / s.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-center pb-8">
          <Link
            to="/spindle"
            className="text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
          >
            View The Spindle
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default Index;
